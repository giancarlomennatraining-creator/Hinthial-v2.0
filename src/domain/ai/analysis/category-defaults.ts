import type { AnalysisDocumentType } from "@/domain/ai/analysis/schemas";

/**
 * La categoria che di norma va con ciascun tipo di documento, per nome. Serve quando il motore non propone una
 * categoria: una bolletta è "Casa" anche se il modello, nel dubbio, tace. Solo i tipi senza ambiguità: un verbale può
 * essere una multa stradale (Veicoli) o un tributo (Fiscale), un certificato la residenza (Personale), la prestazione
 * energetica (Casa) o un'idoneità (Salute), un documento generico non dice niente: lì non si propone nulla.
 * Il nome si cerca tra le categorie dell'utente senza badare alle maiuscole: se l'ha rinominata o eliminata, non si
 * propone niente. L'utente può cambiare la corrispondenza per ogni tipo dalle Impostazioni (v. `TypeCategoryOverrides`).
 */
export const DEFAULT_CATEGORY_BY_TYPE: Partial<Record<AnalysisDocumentType, string>> = {
  polizza: "Assicurazioni",
  bolletta: "Casa",
  contratto: "Contratti",
  referto: "Salute",
  fattura: "Fiscale",
  estratto_conto: "Finanze",
};

/**
 * Le scelte dell'utente: tipo -> id della categoria, oppure null per "nessuna categoria". Un tipo senza voce usa la
 * corrispondenza predefinita.
 */
export type TypeCategoryOverrides = Record<string, string | null>;

/** Il nome della categoria predefinita per un tipo, o null (per mostrarlo in Impostazioni: "Predefinita: Casa"). */
export function defaultCategoryNameFor(type: string): string | null {
  return DEFAULT_CATEGORY_BY_TYPE[type as AnalysisDocumentType] ?? null;
}

/** La categoria dell'utente che corrisponde al tipo (con le sue scelte, se ce ne sono), o null. */
export function defaultCategoryFor(
  type: AnalysisDocumentType | string | null | undefined,
  categories: { id: string; name?: string }[],
  overrides?: TypeCategoryOverrides,
): { id: string; name: string } | null {
  if (!type) return null;

  if (overrides && Object.prototype.hasOwnProperty.call(overrides, type)) {
    const chosen = overrides[type];
    // "Nessuna categoria": l'utente non vuole proposte per questo tipo.
    if (chosen === null) return null;
    const found = categories.find((category) => category.id === chosen);
    if (found) return { id: found.id, name: found.name ?? "" };
    // La categoria scelta non c'è più: per questo tipo vale di nuovo la corrispondenza predefinita.
  }

  const wanted = defaultCategoryNameFor(type);
  if (!wanted) return null;
  const found = categories.find((category) => category.name?.trim().toLowerCase() === wanted.toLowerCase());
  return found ? { id: found.id, name: wanted } : null;
}
