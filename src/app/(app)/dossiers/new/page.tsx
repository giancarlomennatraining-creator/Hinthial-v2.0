"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { CreateDossierForm } from "@/components/dossiers/CreateDossierForm";

export default function NewDossierPage() {
  return (
    <RequireMasterKey>{(masterKey) => <CreateDossierForm masterKey={masterKey} />}</RequireMasterKey>
  );
}
