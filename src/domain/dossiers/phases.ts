/**
 * Le fasi di un fascicolo: le tappe di una vicenda ("Trattativa, Proposta, Mutuo, Rogito") e quella in cui si è.
 * Le sceglie e le sposta l'utente: Hinthial non decide a che punto sei. Facoltative, cifrate sul dispositivo
 * (v. dossiers.encrypted_phases). Puro: nessuna rete, nessun database.
 */

export interface DossierPhases {
  names: string[];
  /** L'indice (da 0) della fase in cui si è. */
  current: number;
}

export const MAX_PHASES = 8;
export const MAX_PHASE_NAME_LENGTH = 30;

/** Punti di partenza: si scelgono con un clic e si possono cambiare prima di salvare. */
export const PHASE_PRESETS: { label: string; names: string[] }[] = [
  { label: "Acquisto casa", names: ["Trattativa", "Proposta", "Mutuo", "Rogito", "Dopo il rogito"] },
  { label: "Salute", names: ["Visite", "Esami", "Cura", "Controlli"] },
  { label: "Incidente", names: ["Denuncia", "Perizia", "Liquidazione", "Chiusura"] },
  { label: "Lavori in casa", names: ["Preventivi", "Permessi", "Lavori", "Collaudo"] },
];

/** "Visite, Esami; Cura" o una per riga → un elenco pulito: senza vuoti né doppioni, nomi e numero limitati. */
export function parsePhaseNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of text.split(/[,;\n]/)) {
    const name = raw.trim().slice(0, MAX_PHASE_NAME_LENGTH).trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length === MAX_PHASES) break;
  }
  return names;
}

/** Fasi valide o niente: senza nomi non c'è nulla da mostrare; un indice fuori dall'elenco torna alla prima o all'ultima. */
export function normalizePhases(input: { names: string[]; current: number }): DossierPhases | null {
  const names = parsePhaseNames(input.names.join(","));
  if (names.length === 0) return null;
  const current = Number.isFinite(input.current) ? Math.min(Math.max(Math.trunc(input.current), 0), names.length - 1) : 0;
  return { names, current };
}

/** Dal JSON decifrato: un dato guasto o di forma inattesa vale "nessuna fase", non un errore che blocca il fascicolo. */
export function parseStoredPhases(json: string): DossierPhases | null {
  try {
    const value: unknown = JSON.parse(json);
    if (!value || typeof value !== "object") return null;
    const { names, current } = value as { names?: unknown; current?: unknown };
    if (!Array.isArray(names) || !names.every((n) => typeof n === "string")) return null;
    return normalizePhases({ names, current: typeof current === "number" ? current : 0 });
  } catch {
    return null;
  }
}

export function serializePhases(phases: DossierPhases): string {
  return JSON.stringify({ names: phases.names, current: phases.current });
}

export type PhaseState = "done" | "current" | "todo";

export function phaseState(phases: DossierPhases, index: number): PhaseState {
  if (index < phases.current) return "done";
  return index === phases.current ? "current" : "todo";
}
