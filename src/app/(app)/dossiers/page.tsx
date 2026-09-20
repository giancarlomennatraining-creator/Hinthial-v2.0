"use client";

import { Suspense } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { DossiersPanel } from "@/components/dossiers/DossiersPanel";

export default function DossiersPage() {
  return (
    <Suspense>
      <RequireMasterKey>{(masterKey) => <DossiersPanel masterKey={masterKey} />}</RequireMasterKey>
    </Suspense>
  );
}
