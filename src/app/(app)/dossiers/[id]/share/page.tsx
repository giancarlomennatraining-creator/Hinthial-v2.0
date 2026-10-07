"use client";

import { use } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { ShareDossierForm } from "@/components/dossiers/ShareDossierForm";

export default function ShareDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireMasterKey>
      {(masterKey) => <ShareDossierForm masterKey={masterKey} dossierId={id} />}
    </RequireMasterKey>
  );
}
