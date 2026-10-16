/**
 * Come un errore diventa una segnalazione (v. migrazione 20261017000002_error_reports.sql): senza dati delle persone e
 * con un'impronta che raggruppa gli errori uguali. Puro, usato sia dal server sia dalla rotta che riceve gli errori del
 * browser. Hinthial è zero-knowledge: un messaggio d'errore non deve diventare la via per cui un dato esce in chiaro.
 */

export type ErrorSource = "server" | "client" | "csp";

export interface ErrorReportInput {
  source: ErrorSource;
  kind: string;
  message: string;
  path: string | null;
  digest: string | null;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const LONG_NUMBER = /\d{6,}/g;
// Un testo tra virgolette dentro un messaggio è spesso un dato (un nome di file, un titolo): via anche quello.
const QUOTED = /"[^"]{1,200}"|“[^”]{1,200}”|«[^»]{1,200}»/g;

export function sanitizeMessage(raw: string): string {
  return raw
    .replace(EMAIL, "[email]")
    .replace(UUID, ":id")
    .replace(QUOTED, '"…"')
    .replace(LONG_NUMBER, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** Solo il percorso: niente dominio, parametri o frammento (il # di un link condiviso contiene la sua chiave). */
export function normalizePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let path = raw;
  try {
    path = new URL(raw, "https://hinthial.invalid").pathname;
  } catch {
    path = raw.split(/[?#]/)[0];
  }
  return path.replace(UUID, ":id").slice(0, 200) || null;
}

/** Un nome di tipo d'errore leggibile e corto ("TypeError", "csp:script-src"). */
export function sanitizeKind(raw: string | null | undefined): string {
  const kind = (raw ?? "").replace(/[^\w:.\- ]/g, "").trim().slice(0, 80);
  return kind || "Error";
}

/** Due errori con la stessa impronta sono "lo stesso errore": stesso tipo, stessa pagina, stesso messaggio a meno dei numeri. */
export async function fingerprintOf(report: ErrorReportInput): Promise<string> {
  const basis = [report.source, report.kind, report.path ?? "", report.message.replace(/\d+/g, "#")].join("|");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Il rumore che non dice nulla di Hinthial: estensioni del browser, script di altri siti, avvisi innocui. */
export function isNoise(message: string, sourceUrl?: string | null): boolean {
  if (sourceUrl && /^(chrome|moz|safari)-extension:/.test(sourceUrl)) return true;
  return /^Script error\.?$|ResizeObserver loop|Non-Error promise rejection captured/i.test(message.trim());
}

/**
 * Valida ciò che arriva dal browser (v. app/api/errors/route.ts): solo errori e blocchi della CSP, campi stringa corti.
 * `null` se non è una segnalazione valida, così la rotta non registra niente.
 */
export function parseClientReport(body: unknown): ErrorReportInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.source !== "client" && b.source !== "csp") return null;
  if (typeof b.message !== "string" || !b.message.trim()) return null;
  if (isNoise(b.message, typeof b.sourceUrl === "string" ? b.sourceUrl : null)) return null;
  return {
    source: b.source,
    kind: sanitizeKind(typeof b.kind === "string" ? b.kind : null),
    message: sanitizeMessage(b.message),
    path: normalizePath(typeof b.path === "string" ? b.path : null),
    digest: typeof b.digest === "string" ? b.digest.replace(/[^\w-]/g, "").slice(0, 60) || null : null,
  };
}
