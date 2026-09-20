"use client";

import { use } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { EditDossierForm } from "@/components/dossiers/EditDossierForm";

export default function EditDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireMasterKey>
      {(masterKey) => <EditDossierForm masterKey={masterKey} dossierId={id} />}
    </RequireMasterKey>
  );
}
