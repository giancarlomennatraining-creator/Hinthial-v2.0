import type { CapsuleListItem } from "@/domain/capsules/types";

/**
 * Cosa racconta da sola una capsula nell'elenco: se è pronta da chiudere, se si apre presto, quanta strada ha fatto verso
 * l'apertura. Tutto si ricava dai dati già in mano alla pagina: nessuna rete, nessun database. Puro.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Entro quanti giorni una capsula si dice "in apertura presto". */
export const OPENING_SOON_DAYS = 30;

export type CapsuleCheckState = "ok" | "warn" | "todo";

export interface CapsuleCheck {
  id: "date" | "content" | "recipients" | "accounts";
  state: CapsuleCheckState;
  label: string;
  detail: string;
}

const dateTimeFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/**
 * Le verifiche prima di chiudere una capsula (che dopo non si può più cambiare): "todo" blocca (senza lettera né allegato, o
 * senza data, non c'è niente da chiudere), "warn" avvisa ma lascia scegliere (nessun destinatario: la aprirai solo tu, come
 * una lettera a se stessi; un destinatario senza account Hinthial non potrà aprirla; una data già passata la apre subito).
 */
export function capsuleChecks(
  capsule: Pick<CapsuleListItem, "content" | "attachments" | "linkedDocuments" | "relatedFriends" | "openAt">,
  now: Date,
): CapsuleCheck[] {
  const checks: CapsuleCheck[] = [];

  if (!capsule.openAt) {
    checks.push({ id: "date", state: "todo", label: "Data di apertura", detail: "Scegli quando si aprirà." });
  } else if (new Date(capsule.openAt).getTime() <= now.getTime()) {
    checks.push({
      id: "date",
      state: "warn",
      label: "Data di apertura",
      detail: "La data è già passata: la capsula si aprirà subito.",
    });
  } else {
    checks.push({
      id: "date",
      state: "ok",
      label: "Data di apertura",
      detail: `Si aprirà il ${dateTimeFormat.format(new Date(capsule.openAt))}.`,
    });
  }

  const words = capsule.content.trim() === "" ? 0 : capsule.content.trim().split(/\s+/).length;
  const files = capsule.attachments.length + capsule.linkedDocuments.length;
  if (words === 0 && files === 0) {
    checks.push({
      id: "content",
      state: "todo",
      label: "Una lettera o un allegato",
      detail: "Aggiungi almeno una delle due cose.",
    });
  } else {
    const parts = [
      words > 0 ? `lettera di ${words} ${words === 1 ? "parola" : "parole"}` : null,
      files > 0 ? `${files} ${files === 1 ? "allegato" : "allegati"}` : null,
    ].filter(Boolean);
    checks.push({ id: "content", state: "ok", label: "Il contenuto", detail: parts.join(" e ") });
  }

  const friends = capsule.relatedFriends;
  if (friends.length === 0) {
    checks.push({
      id: "recipients",
      state: "warn",
      label: "Per chi è",
      detail: "Nessun destinatario: potrai aprirla solo tu.",
    });
  } else {
    checks.push({ id: "recipients", state: "ok", label: "Per chi è", detail: `Per ${listNames(friends.map((f) => f.name))}.` });
    const withoutAccount = friends.filter((f) => !f.linkedUserId).map((f) => f.name);
    checks.push(
      withoutAccount.length === 0
        ? { id: "accounts", state: "ok", label: "Gli account", detail: "Tutti hanno un account Hinthial." }
        : {
            id: "accounts",
            state: "warn",
            label: "Gli account",
            detail:
              withoutAccount.length === 1
                ? `${withoutAccount[0]} non ha ancora un account Hinthial: non potrà aprirla.`
                : `${listNames(withoutAccount)} non hanno ancora un account Hinthial: non potranno aprirla.`,
          },
    );
  }

  return checks;
}

/** Si può chiudere se nessuna verifica blocca. Gli avvisi non impediscono nulla. */
export function canCloseCapsule(checks: CapsuleCheck[]): boolean {
  return checks.every((check) => check.state !== "todo");
}

/** Chiusa o condivisa, e con la data di apertura ancora davanti ma entro i prossimi giorni. Una bozza non conta: la sua data può ancora cambiare. */
export function isOpeningSoon(
  capsule: Pick<CapsuleListItem, "status" | "openAt">,
  now: Date,
  days: number = OPENING_SOON_DAYS,
): boolean {
  if (capsule.status === "draft" || !capsule.openAt) return false;
  const time = new Date(capsule.openAt).getTime();
  return time > now.getTime() && time <= now.getTime() + days * DAY_MS;
}

/** Dalla prossima ad aprirsi alla più lontana; quelle già aperte dopo, e quelle senza data in fondo. */
export function sortByOpening<T extends Pick<CapsuleListItem, "openAt">>(capsules: T[], now: Date): T[] {
  const rank = (capsule: T): number => {
    if (!capsule.openAt) return Number.POSITIVE_INFINITY;
    const time = new Date(capsule.openAt).getTime();
    // Le già aperte vengono dopo quelle future, dalla più recente.
    return time > now.getTime() ? time : Number.MAX_SAFE_INTEGER - time;
  };
  return [...capsules].sort((a, b) => rank(a) - rank(b));
}

/** Quanta strada ha fatto una capsula verso l'apertura, da 0 a 1: dal giorno in cui è stata creata a quello in cui si apre. Una bozza non è partita. */
export function capsuleProgress(
  capsule: Pick<CapsuleListItem, "status" | "openAt" | "createdAt">,
  now: Date,
): number {
  if (capsule.status === "draft" || !capsule.openAt) return 0;
  const start = new Date(capsule.createdAt).getTime();
  const end = new Date(capsule.openAt).getTime();
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}
