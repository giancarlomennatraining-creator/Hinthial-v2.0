/**
 * Prossimi passi e persone di un fascicolo: due elenchi piccoli, scritti dall'utente, cifrati sul dispositivo
 * (v. dossier_items). Puro: nessuna rete, nessun database.
 */

export interface DossierStep {
  id: string;
  dossierId: string;
  text: string;
  /** `YYYY-MM-DD`, se il passo ha un giorno. */
  dueOn: string | null;
  done: boolean;
}

export interface DossierPerson {
  id: string;
  dossierId: string;
  name: string;
  /** "Notaio", "Banca · mutuo": ciò che la persona è per questa vicenda. Può restare vuoto. */
  role: string;
}

export const MAX_STEP_LENGTH = 140;
export const MAX_PERSON_NAME_LENGTH = 60;
export const MAX_PERSON_ROLE_LENGTH = 80;

/** Le iniziali per il tondino di una persona: "Notaio Rossi" → "NR", "Banca" → "B", niente → "?". */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase());
  return letters.length > 0 ? letters.join("") : "?";
}

/** Prima quelli da fare (con data: dal più vicino; senza data: in coda), poi quelli fatti. */
export function sortSteps(steps: DossierStep[]): DossierStep[] {
  const rank = (step: DossierStep) => (step.done ? 2 : step.dueOn ? 0 : 1);
  return [...steps].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.dueOn && b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    return 0;
  });
}

export function parseStepData(json: string): string | null {
  try {
    const value: unknown = JSON.parse(json);
    const text = value && typeof value === "object" ? (value as { text?: unknown }).text : null;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  }
}

export function parsePersonData(json: string): { name: string; role: string } | null {
  try {
    const value: unknown = JSON.parse(json);
    if (!value || typeof value !== "object") return null;
    const { name, role } = value as { name?: unknown; role?: unknown };
    if (typeof name !== "string" || !name.trim()) return null;
    return { name, role: typeof role === "string" ? role : "" };
  } catch {
    return null;
  }
}
