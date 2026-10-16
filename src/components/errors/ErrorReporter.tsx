"use client";

import { useEffect } from "react";
import { reportClientError, reportUnknownError } from "@/lib/errors/report-client";

/**
 * Ascolta gli errori del browser che nessuno ha gestito, e i blocchi della Content-Security-Policy, e li segnala (v.
 * lib/errors/report-client.ts). Montato una volta nel layout radice, non disegna nulla.
 */
export function ErrorReporter() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      if (event.error) {
        reportClientError({
          source: "client",
          kind: event.error instanceof Error ? event.error.name : "Error",
          message: event.error instanceof Error ? event.error.message : String(event.error),
          sourceUrl: event.filename || null,
        });
      } else if (event.message) {
        reportClientError({ source: "client", kind: "Error", message: event.message, sourceUrl: event.filename || null });
      }
    }
    function onRejection(event: PromiseRejectionEvent) {
      reportUnknownError(event.reason);
    }
    function onCspViolation(event: SecurityPolicyViolationEvent) {
      // Solo l'origine di ciò che è stato bloccato ("inline", "eval" o un dominio), mai l'indirizzo completo.
      let blocked = event.blockedURI || "inline";
      try {
        if (/^https?:/.test(blocked)) blocked = new URL(blocked).origin;
      } catch {
        // resta com'è
      }
      reportClientError({
        source: "csp",
        kind: `csp:${event.effectiveDirective || event.violatedDirective}`,
        message: `bloccato ${blocked}`,
        sourceUrl: event.sourceFile || null,
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("securitypolicyviolation", onCspViolation);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("securitypolicyviolation", onCspViolation);
    };
  }, []);

  return null;
}
