/**
 * Manda un errore del browser a /api/errors (v. app/api/errors/route.ts). Solo nel browser. Il server ripulisce tutto
 * (v. sanitize.ts), ma già qui non si mandano dati: niente stack, niente contenuti, solo tipo, messaggio e pagina.
 * Al massimo 10 segnalazioni per pagina caricata e mai la stessa due volte: un errore in un ciclo non diventa una raffica.
 */

const MAX_PER_PAGE = 10;
const sent = new Set<string>();

export interface ClientErrorReport {
  source: "client" | "csp";
  kind: string;
  message: string;
  digest?: string | null;
  sourceUrl?: string | null;
}

export function reportClientError(report: ClientErrorReport): void {
  if (typeof window === "undefined") return;
  const key = `${report.source}|${report.kind}|${report.message}`;
  if (sent.has(key) || sent.size >= MAX_PER_PAGE) return;
  sent.add(key);

  const body = JSON.stringify({ ...report, message: report.message.slice(0, 1000), path: window.location.pathname });
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/errors", blob)) return;
  } catch {
    // si prova con fetch
  }
  fetch("/api/errors", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(
    () => {},
  );
}

/** Un errore qualunque (anche non `Error`) nella forma da segnalare. */
export function reportUnknownError(value: unknown, digest?: string | null): void {
  const error = value instanceof Error ? value : null;
  reportClientError({
    source: "client",
    kind: error?.name || "Error",
    message: error?.message || String(value),
    digest: digest ?? null,
  });
}
