import type { CapsuleListItem, CapsuleStatus } from "@/domain/capsules/types";

/**
 * Cosa racconta da sola una capsula nell'elenco: se è pronta da chiudere, se si apre presto, e dove cadono le aperture
 * nel tempo (la "linea del futuro"). Tutto si ricava dai dati già in mano alla pagina: nessuna rete, nessun database. Puro.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Entro quanti giorni una capsula si dice "in apertura presto". */
export const OPENING_SOON_DAYS = 30;

export type CapsuleFilter = "all" | CapsuleStatus | "soon";

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

export function matchesCapsuleFilter(
  capsule: Pick<CapsuleListItem, "status" | "openAt">,
  filter: CapsuleFilter,
  now: Date,
): boolean {
  if (filter === "all") return true;
  if (filter === "soon") return isOpeningSoon(capsule, now);
  return capsule.status === filter;
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

export interface FutureMarker {
  id: string;
  title: string;
  openAt: string;
  status: CapsuleStatus;
  /** 0 = oggi, 100 = l'ultima apertura. */
  percent: number;
  /** L'etichetta sopra o sotto la linea, alternate per non sovrapporsi. */
  side: "above" | "below";
}

export interface FutureTick {
  year: number;
  percent: number;
}

export interface FutureLine {
  markers: FutureMarker[];
  ticks: FutureTick[];
  /** Quante aperture future non sono state disegnate (troppe per leggersi). */
  hidden: number;
}

/** Quante aperture al massimo si disegnano: oltre, le etichette non si leggono più. */
export const MAX_FUTURE_MARKERS = 8;

/** Ogni quanti anni mettere un'etichetta sull'asse, in modo da averne al massimo sei. */
function yearStep(years: number): number {
  const steps = [1, 2, 5, 10, 20, 50];
  return steps.find((step) => years / step <= 6) ?? 50;
}

/**
 * La linea del futuro: da oggi all'ultima apertura prevista, con le capsule non ancora aperte come tappe. Null se nessuna
 * capsula ha una data davanti. L'asse dura almeno un anno, così una sola capsula tra due settimane non finisce in fondo.
 */
export function buildFutureLine(
  capsules: Pick<CapsuleListItem, "id" | "title" | "openAt" | "status">[],
  now: Date,
): FutureLine | null {
  const upcoming = capsules
    .filter((c): c is typeof c & { openAt: string } => c.openAt !== null && new Date(c.openAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.openAt).getTime() - new Date(b.openAt).getTime());
  if (upcoming.length === 0) return null;

  const start = now.getTime();
  const last = new Date(upcoming[upcoming.length - 1].openAt).getTime();
  const span = Math.max(last - start, 365 * DAY_MS);

  const drawn = upcoming.slice(0, MAX_FUTURE_MARKERS);
  const markers: FutureMarker[] = drawn.map((capsule, index) => ({
    id: capsule.id,
    title: capsule.title,
    openAt: capsule.openAt,
    status: capsule.status,
    percent: ((new Date(capsule.openAt).getTime() - start) / span) * 100,
    side: index % 2 === 0 ? "above" : "below",
  }));

  const years = span / (365 * DAY_MS);
  const step = yearStep(years);
  const firstYear = now.getFullYear() + 1;
  const ticks: FutureTick[] = [];
  for (let year = firstYear; ; year++) {
    const percent = ((new Date(year, 0, 1).getTime() - start) / span) * 100;
    if (percent > 100) break;
    if ((year - firstYear) % step === 0 && percent > 3) ticks.push({ year, percent });
  }

  return { markers, ticks, hidden: upcoming.length - drawn.length };
}
