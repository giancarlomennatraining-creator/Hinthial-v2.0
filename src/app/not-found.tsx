import type { Metadata } from "next";
import Link from "next/link";
import { StatusScreen } from "@/components/layout/StatusScreen";
import { BTN_PRIMARY } from "@/components/ui/styles";

export const metadata: Metadata = {
  title: "Pagina non trovata · HINTHIAL",
};

/** Un indirizzo che non porta da nessuna parte: un link vecchio, un errore di battitura, qualcosa che è stato eliminato. */
export default function NotFound() {
  return (
    <StatusScreen
      eyebrow="Errore 404"
      title="Questa pagina non c'è"
      actions={
        <>
          <Link href="/dashboard" className={BTN_PRIMARY}>
            Vai a Oggi
          </Link>
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            Pagina iniziale
          </Link>
        </>
      }
    >
      <p>
        L&apos;indirizzo potrebbe essere sbagliato, oppure porta a qualcosa che non esiste più: un contenuto eliminato, una
        capsula o un fascicolo che non è più condiviso con te.
      </p>
    </StatusScreen>
  );
}
