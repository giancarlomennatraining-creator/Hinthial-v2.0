/**
 * FASE 12 --- "Eredità digitale" (internamente Dead Man's Switch, mai
 * questo nome in interfaccia: v. richiesta utente). Primo passo:
 * solo i parametri numerici della strategia, discussi a fondo con
 * l'utente prima di scrivere qualunque riga di questo file. Nessuna
 * automazione reale ancora --- rilevamento inattività, promemoria,
 * coinvolgimento guardiani e apertura capsule arriveranno in fasi
 * successive, che leggeranno questi stessi valori (v.
 * domain/digital-legacy/repository.ts).
 *
 * I guardiani (v. friends.is_guardian) verificano soltanto che il
 * proprietario stia bene --- non ereditano automaticamente l'accesso
 * alle capsule, che restano decise capsula per capsula come sempre (v.
 * domain/capsules).
 */
export type DigitalLegacyPreset = "cautious" | "balanced" | "relaxed" | "custom";

/** Quanti guardiani devono confermare l'irraggiungibilità del proprietario prima di procedere alla verifica formale. */
export type GuardianQuorum = "unanimous" | "majority" | "single";

export interface DigitalLegacySettings {
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

export type DigitalLegacyPresetValues = Omit<DigitalLegacySettings, "preset">;

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

/**
 * Limiti applicati anche in modalità "custom" (v. richiesta utente):
 * evitano configurazioni assurde --- es. una soglia di inattività di
 * due giorni --- senza dover spiegare perché un numero specifico non è
 * permesso.
 */
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

/**
 * La frase di riepilogo mostrata sotto lo slider dei preset (v.
 * richiesta utente: "si aggiorna in tempo reale con la scelta
 * corrente") --- linguaggio semplice, mai i 7 valori elencati uno per
 * uno.
 */
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
