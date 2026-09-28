/**
 * Il vocabolario governa la scrittura, non il ragionamento di Claude: senza normalizzare, "Numero Polizza" e
 * "numero_polizza" diventerebbero due voci diverse, vanificando lo scopo (restare consistenti sui documenti
 * successivi). Usata sia lato client sia nella route server-side, sulla stessa chiave grezza restituita da Claude
 * o scelta dall'utente.
 */
export function normalizeFieldKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
