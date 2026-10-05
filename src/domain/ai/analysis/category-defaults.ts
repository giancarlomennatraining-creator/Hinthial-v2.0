import type { AnalysisDocumentType } from "@/domain/ai/analysis/schemas";

/**
 * La categoria che di norma va con ciascun tipo di documento, per nome. Serve quando il motore non propone una
 * categoria: una bolletta è "Casa" anche se il modello, nel dubbio, tace. Solo i tipi senza ambiguità: un verbale può
 * essere una multa stradale (Veicoli) o un tributo (Fiscale), un certificato la residenza (Personale), la prestazione
 * energetica (Casa) o un'idoneità (Salute), un documento generico non dice niente: lì non si propone nulla.
 * Il nome si cerca tra le categorie dell'utente senza badare alle maiuscole: se l'ha rinominata o eliminata, non si
 * propone niente.
 */
export const DEFAULT_CATEGORY_BY_TYPE: Partial<Record<AnalysisDocumentType, string>> = {
  polizza: "Assicurazioni",
  bolletta: "Casa",
  contratto: "Contratti",
  referto: "Salute",
  fattura: "Fiscale",
  estratto_conto: "Finanze",
};

/** La categoria dell'utente che corrisponde al tipo, o null. */
export function defaultCategoryFor(
  type: AnalysisDocumentType | string | null | undefined,
  categories: { id: string; name?: string }[],
): { id: string; name: string } | null {
  const wanted = type ? DEFAULT_CATEGORY_BY_TYPE[type as AnalysisDocumentType] : undefined;
  if (!wanted) return null;
  const found = categories.find((category) => category.name?.trim().toLowerCase() === wanted.toLowerCase());
  return found ? { id: found.id, name: wanted } : null;
}
