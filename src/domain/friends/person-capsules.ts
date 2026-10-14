import type { CapsuleListItem, SharedCapsuleListItem } from "@/domain/capsules/types";

/**
 * Cosa riceverà una persona e cosa mi ha lasciato lei, per la sua scheda in Amici. Puro: nessuna rete, nessun database.
 *
 * Le capsule che le ho scritto stanno in tre gruppi, dal più importante per "se non ci sono più":
 *  - `onDelivery`: già chiuse e con la regola "anche prima, se non ci sono più" accesa (arrivano alla consegna dell'eredità);
 *  - `onDate`: già chiuse, si aprono solo alla loro data;
 *  - `drafts`: ancora bozze, non partiranno finché non le chiudo.
 */
export interface PersonCapsules {
  onDelivery: CapsuleListItem[];
  onDate: CapsuleListItem[];
  drafts: CapsuleListItem[];
}

export function groupCapsulesForPerson(capsules: CapsuleListItem[]): PersonCapsules {
  return {
    onDelivery: capsules.filter((c) => c.status !== "draft" && c.openOnLegacy),
    onDate: capsules.filter((c) => c.status !== "draft" && !c.openOnLegacy),
    drafts: capsules.filter((c) => c.status === "draft"),
  };
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Una frase sola: "3 capsule: 1 arriverà anche se non ci sei, 1 alla sua data, 1 ancora in bozza." */
export function describeCapsulesForPerson(groups: PersonCapsules): string {
  const total = groups.onDelivery.length + groups.onDate.length + groups.drafts.length;
  if (total === 0) return "";

  const parts: string[] = [];
  if (groups.onDelivery.length > 0) {
    parts.push(`${groups.onDelivery.length} ${plural(groups.onDelivery.length, "arriverà", "arriveranno")} anche se non ci sei`);
  }
  if (groups.onDate.length > 0) {
    parts.push(`${groups.onDate.length} ${plural(groups.onDate.length, "si apre", "si aprono")} alla propria data`);
  }
  if (groups.drafts.length > 0) {
    parts.push(`${groups.drafts.length} ${plural(groups.drafts.length, "è ancora una bozza", "sono ancora bozze")}`);
  }
  return `${total} ${plural(total, "capsula", "capsule")}: ${parts.join(", ")}.`;
}

/** Le capsule che questa persona ha condiviso con me, riconosciute dal suo account (v. FriendListItem.linkedUserId). */
export function sharedFromPerson(
  shared: SharedCapsuleListItem[],
  linkedUserId: string | null,
): SharedCapsuleListItem[] {
  if (linkedUserId === null) return [];
  return shared.filter((s) => s.ownerId === linkedUserId);
}

/** Una capsula condivisa con me si può aprire adesso: alla data, o prima se l'eredità del mittente ha consegnato (v. SharedCapsuleListItem.released). */
export function isReadyToOpen(shared: Pick<SharedCapsuleListItem, "openAt" | "released">, now: Date): boolean {
  return shared.released || (shared.openAt !== null && new Date(shared.openAt) <= now);
}
