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
  /**
   * Spento di default per ogni account (v. richiesta utente, discussa
   * esplicitamente prima di costruire l'automazione): finché è spento,
   * nessuna email parte e nessuno stato cambia da solo, qualunque
   * preset/valore sia configurato qui sotto --- un preset scelto in
   * anticipo non ha alcun effetto prima di questo interruttore.
   */
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

/**
 * Tutte e 7 le fasi della roadmap (v. HINTHIAL_MVP.md sezione 10):
 * rilevamento inattività, promemoria, periodo di grazia, coinvolgimento
 * guardiani, verifica formale, attesa finale, apertura capsule.
 * "guardians_confirmed" resta comunque solo un istante di passaggio
 * (avanza da sé a "formal_verification" al giro successivo, senza una
 * propria durata): il vero tempo di attesa di quella fase vive nello
 * stato che segue. "triggered" è l'unico stato senza ritorno per
 * l'EFFETTO che produce (v. digital_legacy_triggered_at su profiles,
 * un marcatore permanente separato da questa colonna, mai azzerato da
 * un reset): l'accesso alle capsule già concesso ai destinatari non si
 * può ritirare, anche se lo stato stesso può tornare "normal" con un
 * accesso successivo del proprietario.
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

/**
 * Se il riscontro dei guardiani raggiunge la soglia richiesta dal
 * quorum scelto (v. Impostazioni > Eredità digitale) --- mai vero con
 * zero guardiani interpellati, qualunque sia il quorum.
 */
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

/**
 * L'unica azione da compiere per questo account a questo giro di
 * controllo --- "none" nella grande maggioranza dei casi. Il chiamante
 * (v. domain/digital-legacy/automation.ts) applica l'azione: aggiorna
 * la riga, manda l'email se prevista, registra l'evento in Attività.
 */
export type DigitalLegacyAction =
  | { type: "none" }
  /**
   * Un accesso del proprietario DOPO l'inizio dello stato attuale
   * ("login"), o un guardiano che conferma "sta bene"
   * ("guardian_confirmed_ok") --- annullano tutto allo stesso modo, si
   * torna a "normal", ma restano distinti nel registro Attività.
   */
  | { type: "reset"; reason: "login" | "guardian_confirmed_ok" }
  /**
   * Invia un promemoria --- `enteringReminding: true` per il primo (che
   * fa anche scattare lo stato "reminding" da "normal", nello stesso
   * momento: niente attesa aggiuntiva oltre alla soglia di inattività
   * già trascorsa prima di scrivere per la prima volta).
   */
  | { type: "send_reminder"; reminderNumber: number; enteringReminding: boolean }
  | { type: "start_grace_period" }
  | { type: "start_awaiting_guardians" }
  /** Il quorum dei guardiani è stato raggiunto --- v. isGuardianQuorumSatisfied. */
  | { type: "guardians_confirmed" }
  /** Passaggio immediato, senza attesa propria --- v. doc comment di DigitalLegacyState. */
  | { type: "start_formal_verification" }
  | { type: "start_final_wait" }
  /** L'azione finale: rende le capsule già condivise leggibili ai destinatari da subito, a prescindere dalla loro open_at --- v. domain/digital-legacy/automation.ts, releaseCapsulesToRecipients. */
  | { type: "trigger_release" };

/**
 * Il "cervello" dell'automazione --- puro, senza alcun accesso a
 * database o orologio di sistema (li riceve come parametri): interamente
 * testabile con date fisse, senza dover davvero aspettare mesi né poter
 * manipolare `last_sign_in_at` di Supabase (gestito da GoTrue, non
 * scrivibile a piacere). v. domain/digital-legacy/automation.ts per chi
 * lo chiama con i dati veri.
 */
export function computeDigitalLegacyTransition(params: {
  now: Date;
  /** L'ultimo accesso noto --- oggi la sola definizione di "attività" usata (v. roadmap, "inactivity detection"); fasi future potranno ampliarla. */
  lastSignInAt: Date;
  settings: DigitalLegacyPresetValues;
  runtime: DigitalLegacyRuntimeState;
  /** Solo significativo in "awaiting_guardians" --- null altrove, o se le richieste non sono ancora state create. */
  guardianTally?: GuardianTally | null;
}): DigitalLegacyAction {
  const { now, lastSignInAt, settings, runtime, guardianTally } = params;

  // Un accesso avvenuto dopo l'inizio dello stato attuale vale più di
  // qualunque fase in corso, a prescindere da quale sia: annulla tutto,
  // sempre. Controllato prima di ogni altra cosa, non solo dentro ai
  // singoli stati.
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

  // "guardians_confirmed" non ha una propria durata --- avanza da sé,
  // subito, al giro successivo (v. doc comment di DigitalLegacyState).
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

  // "triggered": l'effetto (l'accesso alle capsule già concesso) resta
  // per sempre --- v. digital_legacy_triggered_at, un marcatore
  // separato --- ma lo STATO può comunque tornare "normal" con un vero
  // accesso successivo del proprietario (controllato più sopra):
  // qui non c'è altro da fare da soli.
  return { type: "none" };
}

/** Quante richieste ai guardiani, per l'episodio in corso, hanno già una risposta --- letto da guardian_verification_requests dal solo proprietario (v. domain/digital-legacy/repository.ts, getDigitalLegacyStatus). */
export interface GuardianResponseCounts {
  total: number;
  responded: number;
  unreachable: number;
}

/** Ciò che il proprietario vede di sé stesso in Impostazioni > Eredità digitale --- mai i nomi dei guardiani qui (cifrati, decifrabili solo dalla propria rubrica Amici): solo conteggi, già in chiaro lato server. */
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

/**
 * La frase mostrata al proprietario per il proprio stato attuale ---
 * pura, nessun accesso a database: riceve già tutto ciò che le serve
 * come parametri (v. describeDigitalLegacySettings per lo stesso
 * principio). "normal" non produce un banner in interfaccia (v.
 * DigitalLegacyStatusBanner.tsx) --- questa funzione non è nemmeno
 * chiamata in quel caso.
 */
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
