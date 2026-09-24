/**
 * Gestione dei tag, logica pura (stesso schema di trash.ts/duplicates.ts). Non un'entità a sé nel DB: ogni documento
 * porta il proprio array cifrato in un unico blob, quindi rinominare/eliminare un tag vuol dire scorrere i documenti
 * già decifrati in memoria. Confronto case-insensitive alla fonte, altrimenti "Casa"/"casa" resterebbero due tag distinti.
 */

function normalize(raw: string): string {
  return raw.trim();
}

function sameTag(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Aggiunge un tag senza duplicati mascherati (stessa parola, maiuscole diverse) --- mantiene la grafia già presente. */
export function addTagToList(existing: string[], rawTag: string): string[] {
  const trimmed = normalize(rawTag);
  if (!trimmed) return existing;
  if (existing.some((tag) => sameTag(tag, trimmed))) return existing;
  return [...existing, trimmed];
}

/** Toglie da una lista ogni tag che corrisponde (case-insensitive) al nome dato. */
export function removeTagFromList(existing: string[], name: string): string[] {
  return existing.filter((tag) => !sameTag(tag, name));
}

/** True se la lista contiene un tag corrispondente (case-insensitive) al nome dato. */
export function listIncludesTag(existing: string[], name: string): boolean {
  return existing.some((tag) => sameTag(tag, name));
}

/** Se `newName` corrisponde a un tag già presente, il risultato è un merge (prevale la grafia già presente). */
export function renameTagInList(existing: string[], oldName: string, newName: string): string[] {
  const withoutOld = removeTagFromList(existing, oldName);
  if (withoutOld.length === existing.length) return existing; // oldName non c'era
  return addTagToList(withoutOld, newName);
}

export interface TagUsage {
  /** Grafia mostrata --- quella più frequente tra le occorrenze, a parità la prima incontrata. */
  name: string;
  count: number;
}

/** Tag usati con quante volte appare ciascuno, raggruppati case-insensitive --- grafia mostrata: la più frequente. */
export function aggregateTags(documents: { tags: string[] }[]): TagUsage[] {
  const groups = new Map<string, { counts: Map<string, number> }>();

  for (const doc of documents) {
    for (const rawTag of doc.tags) {
      const tag = normalize(rawTag);
      if (!tag) continue;
      const key = tag.toLowerCase();
      let group = groups.get(key);
      if (!group) {
        group = { counts: new Map() };
        groups.set(key, group);
      }
      group.counts.set(tag, (group.counts.get(tag) ?? 0) + 1);
    }
  }

  const result: TagUsage[] = [];
  for (const group of groups.values()) {
    let bestName = "";
    let bestCount = -1;
    let total = 0;
    for (const [spelling, count] of group.counts) {
      total += count;
      if (count > bestCount) {
        bestCount = count;
        bestName = spelling;
      }
    }
    result.push({ name: bestName, count: total });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));
}
