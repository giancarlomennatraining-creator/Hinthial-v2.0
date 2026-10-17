"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusScreen } from "@/components/layout/StatusScreen";
import { BTN_PRIMARY } from "@/components/ui/styles";
import { reportUnknownError } from "@/lib/errors/report-client";

/**
 * Un errore imprevisto in una pagina. Prima di tutto rassicura: i contenuti sono cifrati e salvati, un errore di
 * visualizzazione non li tocca. "Riprova" rifà la pagina (`retry`, v. la guida di error.js di questa versione di Next).
 * Il codice in fondo (`digest`) è quello che si ritrova nei log del server, utile se qualcuno lo segnala.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    // Un errore preso da questa pagina non arriva all'ascoltatore globale: lo si segnala qui (v. lib/errors/).
    reportUnknownError(error, error.digest);
  }, [error]);

  return (
    <StatusScreen
      eyebrow="Qualcosa non è andato"
      title="Questa pagina non si è aperta"
      actions={
        <>
          <button type="button" onClick={() => retry()} className={BTN_PRIMARY}>
            Riprova
          </button>
          <Link href="/dashboard" className="text-sm font-medium text-accent hover:underline">
            Vai a Oggi
          </Link>
        </>
      }
    >
      <p>
        I tuoi contenuti sono al sicuro: sono cifrati e salvati, e un errore nel mostrare la pagina non li tocca. Di solito
        basta riprovare; se non passa, ricarica o torna a Oggi.
      </p>
      {error.digest ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Se lo segnali, questo codice ci aiuta a trovarlo: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}
    </StatusScreen>
  );
}
