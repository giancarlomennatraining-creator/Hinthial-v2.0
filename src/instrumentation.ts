import type { Instrumentation } from "next";

/**
 * Gli errori del server (pagine, rotte API, Server Actions, proxy) finiscono in error_reports (v. lib/errors/), così
 * l'email giornaliera li segnala. L'import è dentro la funzione: il client Supabase si carica solo quando serve davvero.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const [{ recordError }, { normalizePath, sanitizeKind, sanitizeMessage }] = await Promise.all([
    import("@/lib/errors/record"),
    import("@/lib/errors/sanitize"),
  ]);
  const error = err instanceof Error ? err : new Error(String(err));
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : null;
  const userAgent = request.headers["user-agent"];

  await recordError(
    {
      source: "server",
      kind: sanitizeKind(`${error.name} (${context.routeType})`),
      message: sanitizeMessage(error.message || "Errore senza messaggio"),
      // Il percorso del file della rotta (/app/archive/[id]) raggruppa meglio di quello della richiesta.
      path: normalizePath(context.routePath || request.path),
      digest,
    },
    Array.isArray(userAgent) ? (userAgent[0] ?? null) : (userAgent ?? null),
  );
};
