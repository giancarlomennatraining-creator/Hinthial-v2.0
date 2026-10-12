/**
 * Come si apre una capsula per chi la riceve: cinque effetti, scelti da chi la scrive (uno per capsula, v. CapsulePayload.openEffect
 * in repository.ts). Cambiano l'animazione e la pagina di lettura, mai il contenuto. Viaggia nel payload cifrato, non in una
 * colonna in chiaro: chi riceve lo conosce solo dopo aver decifrato, ed è esattamente il momento in cui serve.
 */

export type CapsuleOpenEffect = "zoom" | "hold" | "deck" | "light" | "discreet";

export const DEFAULT_OPEN_EFFECT: CapsuleOpenEffect = "discreet";

export interface OpenEffectOption {
  value: CapsuleOpenEffect;
  label: string;
  /** Una frase per capire a colpo d'occhio cosa si sceglie. */
  description: string;
}

export const OPEN_EFFECT_OPTIONS: OpenEffectOption[] = [
  {
    value: "discreet",
    label: "Sblocco discreto",
    description: "Quasi nessuna scena: un clic e si passa a una pagina calma con la lettera, gli allegati e la storia della capsula.",
  },
  {
    value: "zoom",
    label: "Zoom nell'oblò",
    description: "L'oblò si allarga su tutta la pagina, il volantino gira e la luce diventa la pagina di lettura.",
  },
  {
    value: "hold",
    label: "Tieni premuto",
    description: "Chi la riceve tiene premuto l'oblò finché un anello si riempie: un gesto lento, per qualcosa di importante.",
  },
  {
    value: "deck",
    label: "Ricordi uno a uno",
    description: "Dalla capsula escono la lettera e gli allegati come carte da sfogliare, una per volta, fino al pensiero finale.",
  },
  {
    value: "light",
    label: "Luce e lettera",
    description: "Si abbassa la luce e la lettera appare riga per riga, in grande: l'effetto più intimo.",
  },
];

const OPEN_EFFECTS: CapsuleOpenEffect[] = OPEN_EFFECT_OPTIONS.map((o) => o.value);

export function isOpenEffect(value: unknown): value is CapsuleOpenEffect {
  return typeof value === "string" && (OPEN_EFFECTS as string[]).includes(value);
}

/** Legge il valore grezzo (dal payload o dal profilo), ignorando ciò che non è un effetto: le capsule di prima non lo avevano. */
export function parseOpenEffect(raw: unknown): CapsuleOpenEffect {
  return isOpenEffect(raw) ? raw : DEFAULT_OPEN_EFFECT;
}

/**
 * Spezza una lettera in "righe" da far comparire una alla volta: ogni a capo è una riga, e un paragrafo lungo si divide alle
 * frasi. Mai vuota se c'è del testo; null se la lettera è vuota. Serve all'effetto "Luce e lettera".
 */
export function splitLetterLines(content: string): string[] {
  const lines: string[] = [];
  for (const paragraph of content.split(/\r?\n/)) {
    const trimmed = paragraph.trim();
    if (trimmed === "") continue;
    const sentences = trimmed.split(/(?<=[.!?…])\s+/).filter((s) => s !== "");
    lines.push(...(sentences.length > 0 ? sentences : [trimmed]));
  }
  return lines;
}
