import {
  formatDays,
  type DigitalLegacyPresetValues,
  type GuardianQuorum,
} from "@/domain/digital-legacy/types";

/**
 * Le quattro fasi che si raccontano alla persona. Il motore ha otto stati interni (v. computeDigitalLegacyTransition) e
 * resta quello: qui lo si guarda da fuori, come quattro passi. Pura, nessuna rete.
 *
 *  - Silenzio: inattività, promemoria a te, periodo di grazia (normal, reminding, grace_period).
 *  - Guardiani: l'attesa della loro risposta (awaiting_guardians); non ha una durata fissa.
 *  - Attesa: verifica formale e attesa finale (guardians_confirmed, formal_verification, final_wait).
 *  - Consegna: si aprono le capsule che l'hanno chiesto (triggered).
 */
export interface LegacyPhase {
  id: "silence" | "guardians" | "wait" | "delivery";
  name: string;
  /** Una frase, nella voce di chi ha scelto: cosa succede in questa fase. */
  text: string;
  /** Quanti giorni dura al massimo, o null se dipende da altri (i guardiani). */
  days: number | null;
}

const QUORUM_TEXT: Record<GuardianQuorum, string> = {
  unanimous: "devono essere tutti d'accordo",
  majority: "basta la maggioranza",
  single: "ne basta uno solo",
};

function times(n: number): string {
  return n === 1 ? "una volta" : `${n} volte`;
}

export function legacyPhases(settings: DigitalLegacyPresetValues): LegacyPhase[] {
  const silenceDays =
    settings.inactivityDays + settings.reminderIntervalDays * settings.reminderCount + settings.gracePeriodDays;
  const waitDays = settings.formalVerificationDays + settings.finalWaitDays;

  return [
    {
      id: "silence",
      name: "Silenzio",
      text: `Se non accedi per ${formatDays(settings.inactivityDays)} ti scrivo ${times(settings.reminderCount)}, una ogni ${formatDays(settings.reminderIntervalDays)}. Poi hai ${formatDays(settings.gracePeriodDays)} di grazia.`,
      days: silenceDays,
    },
    {
      id: "guardians",
      name: "Guardiani",
      text: `Chiedo ai tuoi guardiani se riescono a raggiungerti: ${QUORUM_TEXT[settings.guardianQuorum]}. Se uno dice che stai bene, tutto si ferma.`,
      days: null,
    },
    {
      id: "wait",
      name: "Attesa",
      text: `Un'ultima attesa di ${formatDays(waitDays)}. Un tuo accesso annulla ancora tutto.`,
      days: waitDays,
    },
    {
      id: "delivery",
      name: "Consegna",
      text: "Si aprono le capsule che hanno chiesto di aprirsi anche prima della loro data.",
      days: 0,
    },
  ];
}
