import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logAuditEvent } from "@/lib/audit/log-event";
import { sendEmail } from "@/lib/email/send-email";
import {
  digitalLegacyCapsuleReleasedEmail,
  digitalLegacyFinalWaitEmail,
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
 * Giro periodico di "Eredità digitale", una volta al giorno dal cron di Vercel --- ignora chi ha `digital_legacy_enabled`
 * spento (opt-in esplicito) o non ha mai effettuato un accesso. "Attività" = solo `auth.users.last_sign_in_at`.
 * `now` iniettabile solo per i test (le fasi lunghe non si possono simulare aspettando davvero).
 */
export async function runDigitalLegacyCheck(
  admin: SupabaseClient<Database>,
  now: Date = new Date(),
): Promise<DigitalLegacyCheckSummary> {
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

/** Applica l'azione decisa da computeDigitalLegacyTransition: riga, email (best-effort), evento in Attività. */
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
    // Episodio annullato: le richieste ai guardiani non servono più, non restano "in sospeso" per sempre.
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

  if (action.type === "guardians_confirmed") {
    // Ultimo avviso al proprietario --- poi, senza attesa propria, si passa subito alla verifica formale.
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
    return;
  }

  if (action.type === "start_formal_verification") {
    // Passaggio immediato, senza email propria --- "guardians_confirmed" ha già detto tutto.
    await admin
      .from("profiles")
      .update({ digital_legacy_state: "formal_verification", digital_legacy_state_entered_at: nowIso })
      .eq("id", userId);
    await logAuditEvent(admin, userId, "digital_legacy_formal_verification_started");
    return;
  }

  if (action.type === "start_final_wait") {
    await admin
      .from("profiles")
      .update({ digital_legacy_state: "final_wait", digital_legacy_state_entered_at: nowIso })
      .eq("id", userId);

    if (email) {
      try {
        const { subject, html } = digitalLegacyFinalWaitEmail(settings.finalWaitDays);
        await sendEmail({ to: email, subject, html });
      } catch (err) {
        console.error("[digital-legacy] failed to send final-wait email:", err);
      }
    }
    await logAuditEvent(admin, userId, "digital_legacy_final_wait_started");
    return;
  }

  // "trigger_release": l'azione finale --- v. doc comment di
  // DigitalLegacyState per perché digital_legacy_triggered_at è una
  // colonna a sé, mai azzerata da un reset successivo.
  await admin
    .from("profiles")
    .update({
      digital_legacy_state: "triggered",
      digital_legacy_state_entered_at: nowIso,
      digital_legacy_triggered_at: nowIso,
    })
    .eq("id", userId);
  await logAuditEvent(admin, userId, "digital_legacy_triggered");
  await releaseCapsulesToRecipients(admin, userId);
}

/** Manda solo l'email --- l'accesso vero è già concesso dalla policy RLS (v. migrazione digital_legacy_release). Rende prima disponibile solo ciò che era già condiviso, non decide da sé chi riceve cosa. */
async function releaseCapsulesToRecipients(admin: SupabaseClient<Database>, ownerId: string): Promise<void> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", ownerId)
    .maybeSingle();
  if (profileError || !profile) {
    console.error("[digital-legacy] failed to read owner profile for capsule release:", profileError?.message);
    return;
  }
  const ownerName = `${profile.first_name} ${profile.last_name}`.trim();

  // Due query batch, mai un join lato server (stesso schema di listCapsulesSharedWithMe).
  const { data: sharedCapsules, error: capsulesError } = await admin
    .from("capsules")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("status", "shared");
  if (capsulesError) {
    console.error("[digital-legacy] failed to list shared capsules:", capsulesError.message);
    return;
  }
  if (!sharedCapsules || sharedCapsules.length === 0) return;

  const { data: shares, error: sharesError } = await admin
    .from("capsule_shares")
    .select("recipient_user_id")
    .in(
      "capsule_id",
      sharedCapsules.map((c) => c.id),
    );
  if (sharesError) {
    console.error("[digital-legacy] failed to list capsule recipients:", sharesError.message);
    return;
  }
  if (!shares || shares.length === 0) return;

  const recipientIds = [...new Set(shares.map((s) => s.recipient_user_id))];
  for (const recipientId of recipientIds) {
    try {
      const { data: recipientAuth, error: recipientAuthError } = await admin.auth.admin.getUserById(recipientId);
      if (recipientAuthError || !recipientAuth.user?.email) continue;

      const { subject, html } = digitalLegacyCapsuleReleasedEmail(ownerName);
      await sendEmail({ to: recipientAuth.user.email, subject, html });
    } catch (err) {
      console.error("[digital-legacy] failed to notify a capsule recipient:", err);
    }
  }
}

/**
 * Interpella ogni guardiano COLLEGATO (senza account non è raggiungibile). Zero guardiani collegati: resta in
 * "awaiting_guardians" senza avanzare. Esportata per essere testabile senza simulare i giorni di inattività veri.
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
