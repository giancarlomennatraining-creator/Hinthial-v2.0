"use client";

import { Suspense } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { AssetsPanel } from "@/components/assets/AssetsPanel";

export default function AssetsPage() {
  return (
    <Suspense>
      <RequireMasterKey>{(masterKey) => <AssetsPanel masterKey={masterKey} />}</RequireMasterKey>
    </Suspense>
  );
}
