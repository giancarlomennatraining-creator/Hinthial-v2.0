/**
 * Lo stile con cui si presenta l'elenco delle capsule --- scelto in Impostazioni > Aspetto > Capsule, sincronizzato sul server
 * (profiles.capsule_style) come lo stile della Dashboard. Gli stili mostrano gli stessi dati: cambia solo l'involucro.
 */

export type CapsuleStyle = "envelope" | "flat" | "porthole";

export const DEFAULT_CAPSULE_STYLE: CapsuleStyle = "envelope";

export interface CapsuleStyleOption {
  value: CapsuleStyle;
  label: string;
  /** Una frase per capire a colpo d'occhio cosa si sceglie (mostrata nelle Impostazioni). */
  description: string;
}

export const CAPSULE_STYLE_OPTIONS: CapsuleStyleOption[] = [
  { value: "envelope", label: "Buste", description: "Ogni capsula è una busta con il suo sigillo: lo stile di sempre." },
  { value: "flat", label: "Flat", description: "Una piccola capsula del tempo illustrata in cima a ogni scheda, con colori tenui e il conto alla rovescia su una targhetta." },
  { value: "porthole", label: "Oblò", description: "Righe compatte: ogni capsula si guarda attraverso un oblò, con un anello che si riempie man mano che la data si avvicina." },
];

const CAPSULE_STYLES: CapsuleStyle[] = CAPSULE_STYLE_OPTIONS.map((o) => o.value);

export function isCapsuleStyle(value: unknown): value is CapsuleStyle {
  return typeof value === "string" && (CAPSULE_STYLES as string[]).includes(value);
}

/** Legge il valore grezzo dalla riga di profiles, ignorando valori inattesi. */
export function parseCapsuleStyle(raw: unknown): CapsuleStyle {
  return isCapsuleStyle(raw) ? raw : DEFAULT_CAPSULE_STYLE;
}
