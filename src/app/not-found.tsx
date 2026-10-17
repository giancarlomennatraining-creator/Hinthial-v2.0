import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { StatusScreen } from "@/components/layout/StatusScreen";
import { BTN_PRIMARY } from "@/components/ui/styles";

export const metadata: Metadata = {
  title: "Pagina non trovata · HINTHIAL",
};

/** Un indirizzo che non porta da nessuna parte: un link vecchio, un errore di battitura, qualcosa che è stato eliminato. */
export default async function NotFound() {
  // Chi non ha fatto l'accesso non ha un "Oggi" da cui ripartire: "Vai a Oggi" lo porterebbe al login senza dirlo.
  const user = await getCurrentUser();
  return (
    <StatusScreen
      eyebrow="Errore 404"
      title="Questa pagina non c'è"
      actions={
        <>
          <Link href={user ? "/dashboard" : "/login"} className={BTN_PRIMARY}>
            {user ? "Vai a Oggi" : "Accedi"}
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
