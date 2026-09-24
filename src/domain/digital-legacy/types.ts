/**
 * FASE 12: "Eredità digitale" (internamente Dead Man's Switch, mai in interfaccia). I guardiani (v. friends.is_guardian)
 * verificano solo che il proprietario stia bene --- non ereditano l'accesso alle capsule, deciso capsula per capsula come sempre.
 */
export type DigitalLegacyPreset = "cautious" | "balanced" | "relaxed" | "custom";

/** Quanti guardiani devono confermare l'irraggiungibilità del proprietario prima di procedere alla verifica formale. */
export type GuardianQuorum = "unanimous" | "majority" | "single";

export interface DigitalLegacySettings {
  /** Spento di default: finché è spento nessuna email parte e nessuno stato cambia, a prescindere dal preset scelto. */
  enabled: boolean;
  preset: DigitalLegacyPreset;
  /** Giorni di inattività prima di iniziare i promemoria. */
  inactivityDays: number;
  /** Ogni quanti giorni si ripete un promemoria. */
  reminderIntervalDays: number;
  /** Quante volte viene ripetuto il promemoria prima del periodo di grazia. */
  reminderCount: number;
  /** Giorni del periodo di grazia, solo del proprietario, prima di coinvolgere i guardiani. */
  gracePeriodDays: number;
  guardianQuorum: GuardianQuorum;
  /** Giorni della verifica formale, dopo la conferma dei guardiani. */
  formalVerificationDays: number;
  /** Giorni dell'attesa finale, prima dell'apertura effettiva delle capsule. */
  finalWaitDays: number;
}

export type DigitalLegacyPresetValues = Omit<DigitalLegacySettings, "preset" | "enabled">;

/** I tre preset proposti all'utente --- "custom" non ha valori propri: è ciò che si ottiene modificando uno di questi a mano. */
export const DIGITAL_LEGACY_PRESET_ORDER: Exclude<DigitalLegacyPreset, "custom">[] = [
  "cautious",
  "balanced",
  "relaxed",
];

export const DIGITAL_LEGACY_PRESET_VALUES: Record<
  Exclude<DigitalLegacyPreset, "custom">,
  DigitalLegacyPresetValues
> = {
  cautious: {
    inactivityDays: 180,
    reminderIntervalDays: 14,
    reminderCount: 4,
    gracePeriodDays: 60,
    guardianQuorum: "unanimous",
    formalVerificationDays: 30,
    finalWaitDays: 30,
  },
  balanced: {
    inactivityDays: 120,
    reminderIntervalDays: 10,
    reminderCount: 3,
    gracePeriodDays: 30,
    guardianQuorum: "majority",
    formalVerificationDays: 14,
    finalWaitDays: 14,
  },
  relaxed: {
    inactivityDays: 60,
    reminderIntervalDays: 7,
    reminderCount: 2,
    gracePeriodDays: 14,
    guardianQuorum: "single",
    formalVerificationDays: 7,
    finalWaitDays: 7,
  },
};

export const DIGITAL_LEGACY_PRESET_LABEL: Record<DigitalLegacyPreset, string> = {
  cautious: "Prudente",
  balanced: "Normale",
  relaxed: "Rilassato",
  custom: "Personalizzato",
};

export const GUARDIAN_QUORUM_LABEL: Record<GuardianQuorum, string> = {
  unanimous: "Serve l'accordo di tutti i guardiani",
  majority: "Basta la maggioranza dei guardiani",
  single: "Basta un solo guardiano",
};

/** Come lo stesso valore va inserito dentro la frase di riepilogo (v. describeDigitalLegacySettings) --- un frammento, non una frase a sé. */
const GUARDIAN_QUORUM_SUMMARY_FRAGMENT: Record<GuardianQuorum, string> = {
  unanimous: "che devono essere tutti d'accordo",
  majority: "di cui basta la maggioranza",
  single: "di cui basta uno solo",
};

export const DEFAULT_DIGITAL_LEGACY_SETTINGS: DigitalLegacySettings = {
  enabled: false,
  preset: "balanced",
  ...DIGITAL_LEGACY_PRESET_VALUES.balanced,
};

type NumericFieldKey =
  | "inactivityDays"
  | "reminderIntervalDays"
  | "reminderCount"
  | "gracePeriodDays"
  | "formalVerificationDays"
  | "finalWaitDays";

/** Limiti applicati anche in "custom", per evitare configurazioni assurde (es. inattività di due giorni). */
export const DIGITAL_LEGACY_BOUNDS: Record<NumericFieldKey, { min: number; max: number }> = {
  inactivityDays: { min: 30, max: 730 },
  reminderIntervalDays: { min: 3, max: 60 },
  reminderCount: { min: 1, max: 10 },
  gracePeriodDays: { min: 7, max: 180 },
  formalVerificationDays: { min: 3, max: 90 },
  finalWaitDays: { min: 3, max: 90 },
};

/** Riporta un valore dentro i limiti consentiti per quel campo --- mai un numero invalido/fuori scala, a prescindere da cosa arriva dall'input. */
export function clampDigitalLegacyField(field: NumericFieldKey, value: number): number {
  const { min, max } = DIGITAL_LEGACY_BOUNDS[field];
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function formatDays(days: number): string {
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30;
    return months === 1 ? "1 mese" : `${months} mesi`;
  }
  return days === 1 ? "1 giorno" : `${days} giorni`;
}

/** Somma delle fasi nel caso peggiore (nessuna risposta a nessun promemoria) --- v. describeDigitalLegacySettings. */
export function totalWorstCaseDays(settings: DigitalLegacyPresetValues): number {
  return (
    settings.inactivityDays +
    settings.reminderIntervalDays * settings.reminderCount +
    settings.gracePeriodDays +
    settings.formalVerificationDays +
    settings.finalWaitDays
  );
}

function formatApprox(days: number): string {
  const months = days / 30;
  if (months >= 11) {
    const years = Math.round((months / 12) * 10) / 10;
    return years <= 1.05 ? "circa un anno" : `circa ${years.toString().replace(".", ",")} anni`;
  }
  const rounded = Math.round(months);
  return rounded <= 1 ? "circa un mese" : `circa ${rounded} mesi`;
}

/** Riepilogo sotto lo slider dei preset, in linguaggio semplice --- mai i 7 valori elencati uno per uno. */
export function describeDigitalLegacySettings(settings: DigitalLegacyPresetValues): string {
  const total = totalWorstCaseDays(settings);
  const reminderTimes = settings.reminderCount === 1 ? "1 volta" : `${settings.reminderCount} volte`;

  return (
    `Aspettiamo ${formatDays(settings.inactivityDays)} di silenzio, poi ti scriviamo ogni ` +
    `${formatDays(settings.reminderIntervalDays)} per ${reminderTimes}, poi altri ` +
    `${formatDays(settings.gracePeriodDays)} prima di coinvolgere i tuoi guardiani ` +
    `(${GUARDIAN_QUORUM_SUMMARY_FRAGMENT[settings.guardianQuorum]}), poi altri ` +
    `${formatDays(settings.formalVerificationDays + settings.finalWaitDays)} di verifica. ` +
    `In totale, nel caso peggiore, ${formatApprox(total)} prima che le capsule si aprano.`
  );
}

/**
 * Le 7 fasi della roadmap (v. HINTHIAL_MVP.md sezione 10). "guardians_confirmed" è solo un istante di passaggio (avanza
 * da sé, senza durata propria). "triggered" è irreversibile nell'EFFETTO (v. digital_legacy_triggered_at, marcatore
 * permanente): l'accesso già concesso non si ritira, anche se lo STATO può tornare "normal" con un accesso successivo.
 */
export type DigitalLegacyState =
  | "normal"
  | "reminding"
  | "grace_period"
  | "awaiting_guardians"
  | "guardians_confirmed"
  | "formal_verification"
  | "final_wait"
  | "triggered";

/** Il riscontro raccolto finora dai guardiani per l'episodio "awaiting_guardians" in corso --- v. domain/digital-legacy/automation.ts, che lo calcola dalle righe di guardian_verification_requests. */
export interface GuardianTally {
  /** Quanti guardiani collegati sono stati interpellati in questo episodio --- congelato alla creazione delle richieste, non ricalcolato sui guardiani attuali. */
  totalGuardians: number;
  /** Se almeno un guardiano ha risposto "sta bene" --- vale come un accesso del proprietario stesso: annulla tutto. */
  anyConfirmedOk: boolean;
  /** Quanti guardiani hanno risposto "confermo che non riesco a raggiungerlo". */
  confirmedUnreachableCount: number;
}

/** Se il riscontro raggiunge la soglia del quorum scelto --- mai vero con zero guardiani interpellati. */
export function isGuardianQuorumSatisfied(quorum: GuardianQuorum, tally: GuardianTally): boolean {
  if (tally.totalGuardians === 0) return false;
  switch (quorum) {
    case "unanimous":
      return tally.confirmedUnreachableCount >= tally.totalGuardians;
    case "majority":
      return tally.confirmedUnreachableCount > tally.totalGuardians / 2;
    case "single":
      return tally.confirmedUnreachableCount >= 1;
  }
}

/** Lo stato osservato di un account al momento del controllo --- letto da profiles, mai inventato. */
export interface DigitalLegacyRuntimeState {
  state: DigitalLegacyState;
  /** ISO --- quando è iniziato lo stato attuale. */
  stateEnteredAt: string;
  /** Quanti promemoria sono già stati inviati nello stato "reminding" attuale. */
  remindersSent: number;
  /** ISO, o null se nessun promemoria è ancora stato inviato in questo stato. */
  lastReminderAt: string | null;
}

/** L'unica azione da compiere a questo giro --- "none" quasi sempre. Applicata dal chiamante (v. automation.ts). */
export type DigitalLegacyAction =
  | { type: "none" }
  /** Login del proprietario o guardiano che conferma "sta bene" --- annullano tutto uguale, ma restano distinti in Attività. */
  | { type: "reset"; reason: "login" | "guardian_confirmed_ok" }
  /** `enteringReminding: true` per il primo, che fa scattare "reminding" da "normal" nello stesso momento. */
  | { type: "send_reminder"; reminderNumber: number; enteringReminding: boolean }
  | { type: "start_grace_period" }
  | { type: "start_awaiting_guardians" }
  | { type: "guardians_confirmed" }
  | { type: "start_formal_verification" }
  | { type: "start_final_wait" }
  /** Rende le capsule già condivise leggibili da subito, a prescindere dalla loro open_at (v. releaseCapsulesToRecipients). */
  | { type: "trigger_release" };

/** Il "cervello" dell'automazione --- puro, testabile con date fisse (non serve aspettare mesi né scrivere `last_sign_in_at`, gestito da GoTrue). */
export function computeDigitalLegacyTransition(params: {
  now: Date;
  /** L'ultimo accesso noto --- oggi la sola definizione di "attività" usata. */
  lastSignInAt: Date;
  settings: DigitalLegacyPresetValues;
  runtime: DigitalLegacyRuntimeState;
  /** Solo significativo in "awaiting_guardians". */
  guardianTally?: GuardianTally | null;
}): DigitalLegacyAction {
  const { now, lastSignInAt, settings, runtime, guardianTally } = params;

  // Un accesso dopo l'inizio dello stato attuale annulla tutto, sempre --- controllato prima di ogni altra cosa.
  if (runtime.state !== "normal" && lastSignInAt.getTime() > new Date(runtime.stateEnteredAt).getTime()) {
    return { type: "reset", reason: "login" };
  }

  const daysSince = (from: Date): number => (now.getTime() - from.getTime()) / 86_400_000;

  if (runtime.state === "normal") {
    if (daysSince(lastSignInAt) >= settings.inactivityDays) {
      return { type: "send_reminder", reminderNumber: 1, enteringReminding: true };
    }
    return { type: "none" };
  }

  if (runtime.state === "reminding") {
    if (runtime.remindersSent >= settings.reminderCount) {
      return { type: "start_grace_period" };
    }
    const since = runtime.lastReminderAt ? new Date(runtime.lastReminderAt) : new Date(runtime.stateEnteredAt);
    if (daysSince(since) >= settings.reminderIntervalDays) {
      return { type: "send_reminder", reminderNumber: runtime.remindersSent + 1, enteringReminding: false };
    }
    return { type: "none" };
  }

  if (runtime.state === "grace_period") {
    if (daysSince(new Date(runtime.stateEnteredAt)) >= settings.gracePeriodDays) {
      return { type: "start_awaiting_guardians" };
    }
    return { type: "none" };
  }

  if (runtime.state === "awaiting_guardians") {
    if (guardianTally?.anyConfirmedOk) {
      return { type: "reset", reason: "guardian_confirmed_ok" };
    }
    if (guardianTally && isGuardianQuorumSatisfied(settings.guardianQuorum, guardianTally)) {
      return { type: "guardians_confirmed" };
    }
    return { type: "none" };
  }

  // Nessuna durata propria --- avanza subito (v. doc comment di DigitalLegacyState).
  if (runtime.state === "guardians_confirmed") {
    return { type: "start_formal_verification" };
  }

  if (runtime.state === "formal_verification") {
    if (daysSince(new Date(runtime.stateEnteredAt)) >= settings.formalVerificationDays) {
      return { type: "start_final_wait" };
    }
    return { type: "none" };
  }

  if (runtime.state === "final_wait") {
    if (daysSince(new Date(runtime.stateEnteredAt)) >= settings.finalWaitDays) {
      return { type: "trigger_release" };
    }
    return { type: "none" };
  }

  // "triggered": l'effetto resta per sempre, ma lo STATO può tornare "normal" con un accesso (controllato più sopra).
  return { type: "none" };
}

/** Quante richieste ai guardiani, per l'episodio in corso, hanno già una risposta --- letto da guardian_verification_requests dal solo proprietario (v. domain/digital-legacy/repository.ts, getDigitalLegacyStatus). */
export interface GuardianResponseCounts {
  total: number;
  responded: number;
  unreachable: number;
}

/** Ciò che il proprietario vede di sé in Impostazioni > Eredità digitale --- solo conteggi in chiaro, mai i nomi dei guardiani (cifrati). */
export interface DigitalLegacyStatus {
  state: DigitalLegacyState;
  stateEnteredAt: string;
  triggeredAt: string | null;
  remindersSent: number;
  guardianResponseCounts: GuardianResponseCounts | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

/** Frase mostrata al proprietario per il proprio stato --- pura, nessun accesso a database. "normal" non produce banner. */
export function describeDigitalLegacyStatus(status: DigitalLegacyStatus, reminderCount: number): string {
  switch (status.state) {
    case "normal":
      return "Tutto normale: nessun promemoria in corso.";
    case "reminding":
      return `Non hai effettuato l'accesso da un po': finora ti abbiamo scritto ${status.remindersSent} di ${reminderCount} promemoria previsti. Accedi in qualunque momento per annullare tutto.`;
    case "grace_period":
      return `Sei nel periodo di grazia, iniziato il ${formatDate(status.stateEnteredAt)}: nessun guardiano è stato ancora coinvolto. Accedi in qualunque momento per annullare tutto.`;
    case "awaiting_guardians": {
      const c = status.guardianResponseCounts;
      return c
        ? `I tuoi guardiani sono stati interpellati: ${c.responded} di ${c.total} hanno risposto finora (${c.unreachable} confermano di non riuscire a raggiungerti). Accedi in qualunque momento per annullare tutto.`
        : "I tuoi guardiani sono stati interpellati, in attesa di risposta. Accedi in qualunque momento per annullare tutto.";
    }
    case "guardians_confirmed":
    case "formal_verification":
      return "I tuoi guardiani hanno confermato di non riuscire a raggiungerti: è in corso una verifica formale. Accedi in qualunque momento per annullare tutto.";
    case "final_wait":
      return "Ultima fase prima dell'apertura delle tue capsule già condivise: accedi ora per annullare tutto.";
    case "triggered":
      return `Le tue capsule già condivise sono state aperte ai loro destinatari${status.triggeredAt ? ` il ${formatDate(status.triggeredAt)}` : ""}. Se hai effettuato di nuovo l'accesso, il monitoraggio per il futuro è ripartito da zero --- l'apertura già avvenuta resta però definitiva.`;
  }
}
