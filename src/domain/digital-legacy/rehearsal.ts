import { GUARDIAN_QUORUM_LABEL, type DigitalLegacyPresetValues } from "@/domain/digital-legacy/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import type { FriendListItem } from "@/domain/friends/types";

/**
 * "Prova generale" (Impostazioni > Eredità digitale) --- non "qual è la
 * prossima azione da qui" (v. computeDigitalLegacyTransition, che legge
 * lo stato vero dell'account), ma "se cominciasse oggi, quando
 * succederebbe cosa": la stessa identica matematica dei giorni, solo
 * proiettata avanti in un colpo solo invece che un passo alla volta.
 *
 * Pura per lo stesso motivo di computeDigitalLegacyTransition: nessun
 * accesso a database o all'orologio di sistema, tutto arriva come
 * parametro --- verificabile con date fisse.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export interface RehearsalEvent {
  id: string;
  date: Date;
  /** Presente solo per le fasi che durano un intervallo, non un istante. */
  rangeEndDate?: Date;
  /** Questa data non è determinata dalle impostazioni --- illustra solo un caso possibile (v. guardian-confirmed). */
  isExample?: boolean;
  icon: string;
  title: string;
  detail: string;
}

/**
 * Giorni usati per illustrare QUANDO un guardiano potrebbe rispondere
 * --- a differenza di ogni altra fase, questa non ha una durata
 * configurabile: dipende da quando risponde davvero (v. UI, sempre
 * marcata come esempio). Un numero qualunque, breve e credibile.
 */
const EXAMPLE_GUARDIAN_RESPONSE_DAYS = 5;

/**
 * Il calendario completo, dall'ultimo accesso (qui: `now`, non il vero
 * `last_sign_in_at` --- la prova generale risponde a "se cominciasse
 * OGGI", non racconta un episodio già in corso, quello lo dice già
 * DigitalLegacyStatusBanner) fino all'apertura delle capsule.
 *
 * `guardianNames` vuoto è un caso reale, non un errore (v.
 * automation.ts, notifyGuardians): senza nessun guardiano collegato,
 * "awaiting_guardians" non può avanzare da sola --- il calendario si
 * ferma lì, onestamente, invece di inventare una conferma che non può
 * arrivare.
 */
export function buildDigitalLegacyRehearsal(
  settings: DigitalLegacyPresetValues,
  now: Date,
  guardianNames: string[],
): RehearsalEvent[] {
  const events: RehearsalEvent[] = [
    {
      id: "start",
      date: now,
      icon: "📆",
      title: "Ultimo accesso registrato",
      detail: "Il punto di partenza di questa simulazione --- l'orologio dell'inattività parte da qui.",
    },
  ];

  const remindersStart = addDays(now, settings.inactivityDays);
  const remindersEnd = addDays(remindersStart, settings.reminderIntervalDays * (settings.reminderCount - 1));
  events.push({
    id: "reminders",
    date: remindersStart,
    rangeEndDate: settings.reminderCount > 1 ? remindersEnd : undefined,
    icon: "📧",
    title:
      settings.reminderCount === 1
        ? "Un promemoria via email"
        : `${settings.reminderCount} promemoria via email, ogni ${settings.reminderIntervalDays} giorni`,
    detail: "Tutti a te. Accedere in qualunque momento, anche qui, annulla tutto.",
  });

  const graceEnd = addDays(remindersEnd, settings.gracePeriodDays);
  events.push({
    id: "grace",
    date: remindersEnd,
    rangeEndDate: graceEnd,
    icon: "⏳",
    title: "Periodo di grazia",
    detail: "Nessun guardiano è ancora coinvolto --- nessuna email in questa fase, solo attesa.",
  });

  const guardianList = guardianNames.length > 0 ? guardianNames.join(" e ") : null;
  events.push({
    id: "guardians-contacted",
    date: graceEnd,
    icon: "🛡️",
    title: "I tuoi guardiani vengono interpellati",
    detail: guardianList
      ? `Email a ${guardianList}, con un link per confermare che non riescono a raggiungerti.`
      : "Nessun guardiano collegato oggi: senza nemmeno uno, questa fase non può avanzare da sola. Accedere di nuovo resta comunque sempre possibile, e collegare un guardiano da Amici farebbe proseguire la simulazione.",
  });

  // Senza guardiani, il calendario si ferma qui --- onestamente, non
  // per un limite di questa funzione ma perché è ciò che accadrebbe
  // davvero (v. doc comment sopra).
  if (!guardianList) return events;

  const guardianConfirmedAt = addDays(graceEnd, EXAMPLE_GUARDIAN_RESPONSE_DAYS);
  events.push({
    id: "guardian-confirmed",
    date: guardianConfirmedAt,
    isExample: true,
    icon: "✅",
    title: `${guardianNames[0]} conferma`,
    detail: `${GUARDIAN_QUORUM_LABEL[settings.guardianQuorum]} --- questa data non è fissa, dipende da quando risponde davvero.`,
  });

  const formalEnd = addDays(guardianConfirmedAt, settings.formalVerificationDays);
  events.push({
    id: "formal",
    date: guardianConfirmedAt,
    rangeEndDate: formalEnd,
    icon: "🔍",
    title: "Verifica formale",
    detail: "Nessuna email propria --- il conteggio riparte subito dopo la conferma dei guardiani.",
  });

  const finalEnd = addDays(formalEnd, settings.finalWaitDays);
  events.push({
    id: "final-wait",
    date: formalEnd,
    rangeEndDate: finalEnd,
    icon: "⏳",
    title: "Attesa finale",
    detail: "Un'ultima email a te, all'inizio di questa fase: l'ultima occasione per annullare accedendo.",
  });

  events.push({
    id: "triggered",
    date: finalEnd,
    icon: "🔓",
    title: "Le capsule già condivise si aprono",
    detail: "Ogni destinatario riceve un'email --- solo per le capsule già condivise, mai le bozze.",
  });

  return events;
}

export interface RecipientGroup {
  recipient: FriendListItem;
  capsules: CapsuleListItem[];
}

/**
 * Chi riceverebbe cosa se le capsule già condivise si aprissero oggi
 * --- stesso filtro di shareCapsule() (v. domain/capsules/repository.ts):
 * solo le capsule "shared", e solo i destinatari con un account
 * collegato (`linkedUserId`), perché solo a loro shareCapsule crea
 * davvero una riga in capsule_shares. Un destinatario senza account
 * collegato è un destinatario scelto ma irraggiungibile lato server,
 * quindi non riceverebbe nulla da solo.
 */
export function groupSharedCapsulesByRecipient(capsules: CapsuleListItem[]): RecipientGroup[] {
  const groups = new Map<string, RecipientGroup>();

  for (const capsule of capsules) {
    if (capsule.status !== "shared") continue;
    for (const friend of capsule.relatedFriends) {
      if (!friend.linkedUserId) continue;
      const existing = groups.get(friend.id);
      if (existing) existing.capsules.push(capsule);
      else groups.set(friend.id, { recipient: friend, capsules: [capsule] });
    }
  }

  return [...groups.values()];
}
