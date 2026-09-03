import type { Category } from "@/domain/categories/types";

/**
 * Suggerisce una categoria per un documento appena scelto, per ridurre
 * l'attrito nel form di caricamento --- mai imposta, solo un default già
 * riempito che l'utente può correggere in un clic. Un'unica
 * implementazione euristica oggi (v. heuristic-provider.ts), pensata
 * come AIProvider (FASE 10) per essere sostituita in futuro da una vera
 * AI senza toccare chi la chiama.
 */
export interface Categorizer {
  /** Restituisce l'id di una categoria tra quelle date, o null se nessuna corrispondenza è abbastanza chiara. */
  suggestCategory(filename: string, categories: Category[]): string | null;
}
