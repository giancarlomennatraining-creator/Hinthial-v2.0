import type { Category } from "@/domain/categories/types";

/**
 * FASE 22: una categoria è abilitata per l'estrazione Claude se il consenso permanente è attivo,
 * oppure se il consenso temporaneo ("per 30 giorni") non è ancora scaduto --- funzione pura,
 * verificata sia lato client (per mostrare/nascondere il bottone) sia lato server (v.
 * app/api/ai/analyze/route.ts, unico vero cancello di autorizzazione).
 */
export function isCategoryEnabledForExtraction(
  category: Pick<Category, "aiExtractionEnabled" | "aiExtractionEnabledUntil">,
  now: Date = new Date(),
): boolean {
  if (category.aiExtractionEnabled) return true;
  if (!category.aiExtractionEnabledUntil) return false;
  return new Date(category.aiExtractionEnabledUntil).getTime() > now.getTime();
}
