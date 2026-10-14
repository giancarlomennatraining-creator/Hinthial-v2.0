export interface AssetListItem {
  id: string;
  /** Decrypted client-side for display. */
  name: string;
  categoryId: string | null;
  /** Cosa succede a questo bene se non ci sei più (a chi va, dove sono le chiavi...). "" se non scritta. Cifrata. */
  legacyNote: string;
  createdAt: string;
}

export interface AssetInput {
  name: string;
  categoryId: string | null;
  /** Se assente, la nota già salvata non si tocca (chi non la gestisce, come l'importazione, non la cancella). */
  legacyNote?: string;
}
