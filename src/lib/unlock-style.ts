/**
 * Come si presenta la finestra di sblocco della master key --- scelta in Impostazioni > Aspetto > Sblocco, sincronizzata
 * sul server (profiles.unlock_style) come lo stile della Dashboard: segue l'utente su ogni dispositivo. Gli stili
 * cambiano solo l'aspetto e le animazioni: lo sblocco è sempre lo stesso (v. UnlockDialog).
 */

export type UnlockStyle = "glass" | "vault" | "fingerprint";

export const DEFAULT_UNLOCK_STYLE: UnlockStyle = "glass";

export interface UnlockStyleOption {
  value: UnlockStyle;
  label: string;
  /** Una frase per capire a colpo d'occhio cosa si sceglie (mostrata nelle Impostazioni). */
  description: string;
}

export const UNLOCK_STYLE_OPTIONS: UnlockStyleOption[] = [
  {
    value: "glass",
    label: "Vetro",
    description:
      "Una lastra di vetro sfocata con un lucchetto che si agita se sbagli e si apre quando la password è giusta.",
  },
  {
    value: "vault",
    label: "Cassaforte",
    description:
      "La porta di una cassaforte: una ruota gira mentre scrivi, i chiavistelli rientrano e la porta si apre piano.",
  },
  {
    value: "fingerprint",
    label: "Impronta",
    description:
      "Prima l'impronta o il volto: tocchi l'anello e un'onda libera lo schermo. La master password sta in un cassetto sotto. Senza impronta sul dispositivo si vede solo la password.",
  },
];

export const UNLOCK_STYLES: UnlockStyle[] = UNLOCK_STYLE_OPTIONS.map((o) => o.value);

export function isUnlockStyle(value: unknown): value is UnlockStyle {
  return typeof value === "string" && (UNLOCK_STYLES as string[]).includes(value);
}

/** Legge il valore grezzo dalla riga di profiles, ignorando valori inattesi. */
export function parseUnlockStyle(raw: unknown): UnlockStyle {
  return isUnlockStyle(raw) ? raw : DEFAULT_UNLOCK_STYLE;
}

/**
 * Quanto dura l'animazione di uscita di ogni stile, dallo sblocco riuscito alla finestra scomparsa. La Cassaforte è la
 * più lenta di proposito: la porta si apre piano e la sfocatura si dissolve mentre lo fa, senza stacchi.
 */
export const UNLOCK_EXIT_MS: Record<UnlockStyle, number> = {
  glass: 1100,
  vault: 2600,
  fingerprint: 1100,
};
