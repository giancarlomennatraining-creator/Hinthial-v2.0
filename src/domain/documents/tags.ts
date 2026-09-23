/**
 * Gestione dei tag --- logica pura, senza I/O (stesso schema di
 * domain/documents/trash.ts e domain/bulk-import/duplicates.ts), per
 * poterla testare senza un database vero.
 *
 * I tag non sono un'entità a sé nel database (a differenza delle
 * categorie): ogni documento porta il proprio array di tag cifrato in
 * un unico blob (v. repository.ts, encryptTags/decryptTags). Non
 * esiste quindi "il tag X" da solo --- esiste solo "i documenti che
 * hanno tra i loro tag qualcosa che corrisponde a X". Rinominare o
 * eliminare un tag vuol dire scorrere i documenti già decifrati in
 * memoria e aggiornare l'array di ognuno.
 *
 * Confronto case-insensitive: senza questo, "Casa" e "casa" sarebbero
 * due tag distinti per sempre (mai stato normalizzato altrove nel
 * codice) --- qui si introduce la normalizzazione alla fonte, sia
 * quando si aggiunge un tag sia quando si aggregano/rinominano.
 */

function normalize(raw: string): string {
  return raw.trim();
}

function sameTag(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Aggiunge un tag a una lista esistente, senza creare un duplicato
 * "sotto mentite spoglie" (stessa parola, maiuscole diverse). Se un
 * tag corrispondente esiste già, la lista non cambia --- si mantiene la
 * grafia già presente, non quella appena digitata.
 */
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

/**
 * Rinomina un tag all'interno di una lista. Se `newName` corrisponde
 * (case-insensitive) a un tag già presente diverso da quello rinominato,
 * il risultato è un merge: i due confluiscono in una sola voce, quella
 * già presente prevale nella grafia. Nessun effetto se `oldName` non è
 * nella lista.
 */
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

/**
 * Elenca tutti i tag usati in un insieme di documenti, con quante volte
 * ciascuno appare --- raggruppati case-insensitive. La grafia mostrata
 * per ogni gruppo è quella più frequente (a parità, la prima incontrata
 * nell'ordine dato), non necessariamente la prima in ordine alfabetico:
 * se 8 documenti hanno "casa" e 1 ha "Casa", il gruppo si chiama "casa".
 */
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
