"use client";

import { useEffect } from "react";
import { reportUnknownError } from "@/lib/errors/report-client";

/**
 * L'ultima rete: un errore nel layout radice, quando nemmeno error.tsx può comparire. Sostituisce tutto il documento,
 * senza i fogli di stile globali (v. la guida di error.js), quindi gli stili sono qui, scritti a mano e nei colori di
 * Hinthial; il tema scuro segue quello del sistema.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportUnknownError(error, error.digest);
  }, [error]);

  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 16px",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "Canvas",
          color: "CanvasText",
          colorScheme: "light dark",
        }}
      >
        <title>Qualcosa non è andato · HINTHIAL</title>
        <main style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#2b4fc4", textTransform: "uppercase" }}>
            Hinthial · qualcosa non è andato
          </p>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>Hinthial non si è aperta</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, opacity: 0.8 }}>
            I tuoi contenuti sono al sicuro: sono cifrati e salvati, e un errore nel mostrare l&apos;app non li tocca. Riprova
            tra un attimo.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                border: 0,
                borderRadius: 12,
                padding: "10px 16px",
                background: "#2b4fc4",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Riprova
            </button>
            {/* Un <a> vero, non next/link: qui il router potrebbe essere proprio la parte rotta. */}
            <a href="/dashboard" style={{ fontSize: 14, color: "#2b4fc4" }}>
              Vai a Oggi
            </a>
          </div>
          {error.digest ? (
            <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
              Codice da indicare se lo segnali: <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
