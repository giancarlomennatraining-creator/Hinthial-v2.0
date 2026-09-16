import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logAuditEvent } from "@/lib/audit/log-event";
import { sendEmail } from "@/lib/email/send-email";
import {
  digitalLegacyGracePeriodEmail,
  digitalLegacyGuardianRequestEmail,
  digitalLegacyGuardiansConfirmedEmail,
  digitalLegacyReminderEmail,
} from "@/lib/email/templates";
import {
  computeDigitalLegacyTransition,
  type DigitalLegacyAction,
  type DigitalLegacyPresetValues,
  type DigitalLegacyRuntimeState,
  type GuardianTally,
} from "@/domain/digital-legacy/types";

const PAGE_SIZE = 200;

export interface DigitalLegacyCheckSummary {
  usersChecked: number;
  transitions: number;
}

/**
 * Il giro periodico di "Eredità digitale" (fasi 1-4: rilevamento
 * inattività, promemoria, periodo di grazia, coinvolgimento guardiani)
 * --- chiamato una volta al giorno dal cron di Vercel (v.
 * app/api/cron/digital-legacy/route.ts). Ignora completamente chi ha
 * `digital_legacy_enabled` spento (v. richiesta utente: opt-in
 * esplicito, mai attivo di default) e chi non ha mai effettuato un
 * accesso (nessuna base per calcolare l'inattività).
 *
 * "Attività" oggi significa solo "accesso" (`auth.users.last_sign_in_at`,
 * gestito da Supabase stesso --- niente colonna nostra da mantenere in
 * sincrono): la definizione più semplice possibile per queste prime
 * fasi, ampliabile in futuro.
 */
export async function runDigitalLegacyCheck(admin: SupabaseClient<Database>): Promise<DigitalLegacyCheckSummary> {
  const now = new Date();
  let usersChecked = 0;
  let transitions = 0;
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      throw new Error(`Impossibile elencare gli utenti: ${error.message}`);
    }
    if (data.users.length === 0) break;

    const ids = data.users.map((u) => u.id);
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select(
        "id, digital_legacy_enabled, digital_legacy_inactivity_days, digital_legacy_reminder_interval_days, digital_legacy_reminder_count, digital_legacy_grace_period_days, digital_legacy_guardian_quorum, digital_legacy_formal_verification_days, digital_legacy_final_wait_days, digital_legacy_state, digital_legacy_state_entered_at, digital_legacy_reminders_sent, digital_legacy_last_reminder_at",
      )
      .in("id", ids);
    if (profilesError) {
      throw new Error(`Impossibile leggere i profili: ${profilesError.message}`);
    }

    const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Un solo giro batch per tutti quelli già in attesa dei guardiani in
    // questa pagina, invece di una query a testa (v. computeGuardianTallies).
    const awaitingIds = (profiles ?? [])
      .filter((p) => p.digital_legacy_enabled && p.digital_legacy_state === "awaiting_guardians")
      .map((p) => p.id);
    const tallies = await computeGuardianTallies(admin, awaitingIds);

    for (const user of data.users) {
      const profile = profilesById.get(user.id);
      if (!profile || !profile.digital_legacy_enabled || !user.last_sign_in_at) continue;

      usersChecked++;

      const settings: DigitalLegacyPresetValues = {
        inactivityDays: profile.digital_legacy_inactivity_days,
        reminderIntervalDays: profile.digital_legacy_reminder_interval_days,
        reminderCount: profile.digital_legacy_reminder_count,
        gracePeriodDays: profile.digital_legacy_grace_period_days,
        guardianQuorum: profile.digital_legacy_guardian_quorum,
        formalVerificationDays: profile.digital_legacy_formal_verification_days,
        finalWaitDays: profile.digital_legacy_final_wait_days,
      };
      const runtime: DigitalLegacyRuntimeState = {
        state: profile.digital_legacy_state,
        stateEnteredAt: profile.digital_legacy_state_entered_at,
        remindersSent: profile.digital_legacy_reminders_sent,
        lastReminderAt: profile.digital_legacy_last_reminder_at,
      };

      const action = computeDigitalLegacyTransition({
        now,
        lastSignInAt: new Date(user.last_sign_in_at),
        settings,
        runtime,
        guardianTally: tallies.get(user.id) ?? null,
      });

      if (action.type === "none") continue;
      transitions++;

      await applyDigitalLegacyAction(admin, user.id, user.email ?? null, action, settings, now);
    }

    if (data.users.length < PAGE_SIZE) break;
    page++;
  }

  return { usersChecked, transitions };
}

/** Un giro batch su guardian_verification_requests per tutti gli owner_id dati, raggruppato in JS --- mai una query per persona. */
async function computeGuardianTallies(
  admin: SupabaseClient<Database>,
  ownerIds: string[],
): Promise<Map<string, GuardianTally>> {
  const tallies = new Map<string, GuardianTally>();
  if (ownerIds.length === 0) return tallies;

  const { data, error } = await admin
    .from("guardian_verification_requests")
    .select("owner_id, response")
    .in("owner_id", ownerIds);
  if (error) {
    throw new Error(`Impossibile leggere le richieste di verifica: ${error.message}`);
  }

  for (const row of data ?? []) {
    const tally = tallies.get(row.owner_id) ?? { totalGuardians: 0, anyConfirmedOk: false, confirmedUnreachableCount: 0 };
    tally.totalGuardians++;
    if (row.response === "ok") tally.anyConfirmedOk = true;
    if (row.response === "unreachable") tally.confirmedUnreachableCount++;
    tallies.set(row.owner_id, tally);
  }

  return tallies;
}

/**
 * Applica l'azione decisa da computeDigitalLegacyTransition: aggiorna
 * la riga, manda l'email/le email se previste (best-effort: un invio
 * fallito non deve impedire di registrare comunque la transizione),
 * registra l'evento in Attività.
 */
async function applyDigitalLegacyAction(
  admin: SupabaseClient<Database>,
  userId: string,
  email: string | null,
  action: DigitalLegacyAction,
  settings: DigitalLegacyPresetValues,
  now: Date,
): Promise<void> {
  const nowIso = now.toISOString();

  if (action.type === "reset") {
    await admin
      .from("profiles")
      .update({
        digital_legacy_state: "normal",
        digital_legacy_state_entered_at: nowIso,
        digital_legacy_reminders_sent: 0,
        digital_legacy_last_reminder_at: null,
      })
      .eq("id", userId);
    // L'episodio è annullato: le richieste ai guardiani (se ce ne
    // furono) non servono più --- non lasciarle "in sospeso" per
    // sempre agli occhi di chi le ha ricevute.
    await admin.from("guardian_verification_requests").delete().eq("owner_id", userId);
    await logAuditEvent(admin, userId, action.reason === "login" ? "digital_legacy_reset" : "digital_legacy_reset_by_guardian");
    return;
  }

  if (action.type === "send_reminder") {
    await admin
      .from("profiles")
      .update({
        ...(action.enteringReminding
          ? { digital_legacy_state: "reminding" as const, digital_legacy_state_entered_at: nowIso }
          : {}),
        digital_legacy_reminders_sent: action.reminderNumber,
        digital_legacy_last_reminder_at: nowIso,
      })
      .eq("id", userId);

    if (email) {
      try {
        const { subject, html } = digitalLegacyReminderEmail(action.reminderNumber, settings.reminderCount);
        await sendEmail({ to: email, subject, html });
      } catch (err) {
        console.error("[digital-legacy] failed to send reminder email:", err);
      }
    }
    await logAuditEvent(admin, userId, "digital_legacy_reminder_sent");
    return;
  }

  if (action.type === "start_grace_period") {
    await admin
      .from("profiles")
      .update({ digital_legacy_state: "grace_period", digital_legacy_state_entered_at: nowIso })
      .eq("id", userId);

    if (email) {
      try {
        const { subject, html } = digitalLegacyGracePeriodEmail(settings.gracePeriodDays);
        await sendEmail({ to: email, subject, html });
      } catch (err) {
        console.error("[digital-legacy] failed to send grace period email:", err);
      }
    }
    await logAuditEvent(admin, userId, "digital_legacy_grace_period_started");
    return;
  }

  if (action.type === "start_awaiting_guardians") {
    await admin
      .from("profiles")
      .update({ digital_legacy_state: "awaiting_guardians", digital_legacy_state_entered_at: nowIso })
      .eq("id", userId);
    await logAuditEvent(admin, userId, "digital_legacy_awaiting_guardians");
    await notifyGuardians(admin, userId);
    return;
  }

  // "guardians_confirmed": ultimo passo di questo incremento --- un
  // avviso finale al proprietario (potrebbe non poterlo più leggere,
  // ma è comunque l'ultima rete di sicurezza), poi ferma qui: la
  // verifica formale è una fase futura, non ancora costruita.
  await admin
    .from("profiles")
    .update({ digital_legacy_state: "guardians_confirmed", digital_legacy_state_entered_at: nowIso })
    .eq("id", userId);

  if (email) {
    try {
      const { subject, html } = digitalLegacyGuardiansConfirmedEmail();
      await sendEmail({ to: email, subject, html });
    } catch (err) {
      console.error("[digital-legacy] failed to send guardians-confirmed email:", err);
    }
  }
  await logAuditEvent(admin, userId, "digital_legacy_guardians_confirmed");
}

/**
 * Interpella ogni guardiano COLLEGATO del proprietario (v. friends.
 * is_guardian/linked_user_id --- un guardiano senza account non è
 * raggiungibile dal server, v. FriendsPanel.tsx) --- una riga per
 * coppia, azzerata a ogni nuovo episodio (upsert), e un'email a testa.
 * Zero guardiani collegati: nessuna richiesta, nessuna email --- resta
 * semplicemente in "awaiting_guardians" senza modo di avanzare, finché
 * il proprietario non ne collega almeno uno o accede di nuovo.
 *
 * Esportata (non solo chiamata da applyDigitalLegacyAction) apposta per
 * essere testabile da sé, senza dover simulare per davvero i giorni di
 * inattività che portano a "awaiting_guardians" --- v.
 * guardian-verification.integration.test.ts.
 */
export async function notifyGuardians(admin: SupabaseClient<Database>, ownerId: string): Promise<void> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", ownerId)
    .maybeSingle();
  if (profileError || !profile) {
    console.error("[digital-legacy] failed to read owner profile for guardian notification:", profileError?.message);
    return;
  }
  const ownerName = `${profile.first_name} ${profile.last_name}`.trim();

  const { data: guardianFriends, error: friendsError } = await admin
    .from("friends")
    .select("id, linked_user_id")
    .eq("owner_id", ownerId)
    .eq("is_guardian", true)
    .not("linked_user_id", "is", null);
  if (friendsError) {
    console.error("[digital-legacy] failed to list guardians:", friendsError.message);
    return;
  }
  if (!guardianFriends || guardianFriends.length === 0) return;

  for (const friend of guardianFriends) {
    const guardianUserId = friend.linked_user_id as string;

    const { data: request, error: upsertError } = await admin
      .from("guardian_verification_requests")
      .upsert(
        {
          owner_id: ownerId,
          guardian_user_id: guardianUserId,
          friend_id: friend.id,
          response: null,
          responded_at: null,
          created_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,guardian_user_id" },
      )
      .select("id")
      .single();
    if (upsertError || !request) {
      console.error("[digital-legacy] failed to create a guardian verification request:", upsertError?.message);
      continue;
    }

    try {
      const { data: guardianAuth, error: guardianAuthError } = await admin.auth.admin.getUserById(guardianUserId);
      if (guardianAuthError || !guardianAuth.user?.email) continue;

      const respondUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/guardian-check/${request.id}`;
      const { subject, html } = digitalLegacyGuardianRequestEmail(ownerName, respondUrl);
      await sendEmail({ to: guardianAuth.user.email, subject, html });
    } catch (err) {
      console.error("[digital-legacy] failed to email a guardian:", err);
    }
  }

  await logAuditEvent(admin, ownerId, "digital_legacy_guardian_requested");
}
