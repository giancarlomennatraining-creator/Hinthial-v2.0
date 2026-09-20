"use client";

import { use } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { DossierDetail } from "@/components/dossiers/DossierDetail";

export default function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireMasterKey>{(masterKey) => <DossierDetail masterKey={masterKey} dossierId={id} />}</RequireMasterKey>
  );
}
