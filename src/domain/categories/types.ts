export interface Category {
  id: string;
  /** Plaintext (like the icon) --- a category name is a generic label, not sensitive content. */
  name: string;
  icon: string;
  /** FASE 22: consenso permanente a mandare a Claude i documenti di questa categoria. */
  aiExtractionEnabled: boolean;
  /** FASE 22: consenso temporaneo ("per 30 giorni") --- se nel futuro, abilita anche con aiExtractionEnabled false. */
  aiExtractionEnabledUntil: string | null;
}

export interface CategoryInput {
  name: string;
  icon: string;
}
