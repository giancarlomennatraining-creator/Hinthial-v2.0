import type { Metadata } from "next";
import { SharedDossierView } from "@/components/dossiers/SharedDossierView";
import { BrandLockup } from "@/components/layout/BrandLockup";

/**
 * La pagina pubblica di un fascicolo condiviso con un link (v. migrazione dossier_shares): nessun account, nessun accesso.
 * Fuori da (app) di proposito, così non chiede il login. Non va indicizzata, e la chiave nel link (dopo il #) non arriva mai
 * al server.
 */
export const metadata: Metadata = {
  title: "Fascicolo condiviso · HINTHIAL",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center bg-background px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <BrandLockup className="h-auto w-48" darkSize="md" />
        <SharedDossierView shareId={id} />
      </div>
    </div>
  );
}
