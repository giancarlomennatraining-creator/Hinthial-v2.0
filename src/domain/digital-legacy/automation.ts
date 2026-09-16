import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logAuditEvent } from "@/lib/audit/log-event";
import { sendEmail } from "@/lib/email/send-email";
import { digitalLegacyGracePeriodEmail, digitalLegacyReminderEmail } from "@/lib/email/templates";
import {
  computeDigitalLegacyTransition,
  type DigitalLegacyAction,
  type DigitalLegacyPresetValues,
  type DigitalLegacyRuntimeState,
} from "@/domain/digital-legacy/types";

const PAGE_SIZE = 200;

export interface DigitalLegacyCheckSummary {
  usersChecked: number;
  transitions: number;
}

/**
 * Il giro periodico di "Eredità digitale" (fasi 1-3: rilevamento
 * inattività, promemoria, periodo di grazia) --- chiamato una volta al
 * giorno dal cron di Vercel (v. app/api/cron/digital-legacy/route.ts).
 * Ignora completamente chi ha `digital_legacy_enabled` spento (v.
 * richiesta utente: opt-in esplicito, mai attivo di default) e chi non
 * ha mai effettuato un accesso (nessuna base per calcolare l'inattività).
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

/**
 * Applica l'azione decisa da computeDigitalLegacyTransition: aggiorna
 * la riga, manda l'email se prevista (best-effort: un invio fallito non
 * deve impedire di registrare comunque la transizione), registra
 * l'evento in Attività.
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
    await logAuditEvent(admin, userId, "digital_legacy_reset");
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

  // "start_awaiting_guardians": nessuna email qui --- il proprietario ha
  // già avuto ogni promemoria possibile. Il coinvolgimento dei guardiani
  // arriverà con una fase futura, non ancora costruita: per ora questo
  // stato è solo un punto fermo, registrato per essere auditabile.
  await admin
    .from("profiles")
    .update({ digital_legacy_state: "awaiting_guardians", digital_legacy_state_entered_at: nowIso })
    .eq("id", userId);
  await logAuditEvent(admin, userId, "digital_legacy_awaiting_guardians");
}
