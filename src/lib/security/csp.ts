/**
 * La Content-Security-Policy di Hinthial. Tutto si decifra nel browser: uno script estraneo nella pagina potrebbe leggere
 * la master key o i contenuti in chiaro. Per questo gli script girano solo con il nonce di quella richiesta (v. proxy.ts);
 * 'strict-dynamic' lascia caricare i pezzi che quegli script chiedono, nient'altro.
 *
 * - 'wasm-unsafe-eval': il motore OCR (tesseract) è WebAssembly. Non permette eval di JavaScript.
 * - style-src 'unsafe-inline': gli attributi `style` (variabili CSS, posizioni animate) non accettano nonce. Uno stile
 *   iniettato non esegue codice.
 * - Supabase è l'unica destinazione esterna dal browser: dati, file cifrati, avatar. Claude e le email passano dal server.
 * - blob: è come si mostrano i file appena decifrati (immagini, audio, video, PDF nel fascicolo condiviso).
 */
export function buildContentSecurityPolicy({
  nonce,
  isDev,
  supabaseUrl,
  upgradeInsecureRequests,
}: {
  nonce: string;
  isDev: boolean;
  supabaseUrl: string | undefined;
  /** Solo quando la pagina arriva in HTTPS: in HTTP su localhost (e2e) spezzerebbe ogni risorsa. */
  upgradeInsecureRequests: boolean;
}): string {
  const supabase = supabaseOrigin(supabaseUrl);
  const supabaseSources = supabase ? ` ${supabase}` : "";

  const directives = [
    "default-src 'self'",
    // In sviluppo React usa eval per ricostruire gli errori del server (v. guida CSP di Next.js): mai in produzione.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${supabaseSources}`,
    "font-src 'self' data:",
    `connect-src 'self'${supabaseSources}`,
    `media-src 'self' blob:${supabaseSources}`,
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (upgradeInsecureRequests) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** "https://xyz.supabase.co/qualcosa" -> "https://xyz.supabase.co"; null se manca o non è un URL. */
function supabaseOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Un nonce nuovo per ogni richiesta: 128 bit casuali in base64. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
