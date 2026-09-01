"use client";

import { Suspense } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { CapsulesPanel } from "@/components/capsules/CapsulesPanel";

export default function CapsulesPage() {
  return (
    <Suspense>
      <RequireMasterKey>{(masterKey) => <CapsulesPanel masterKey={masterKey} />}</RequireMasterKey>
    </Suspense>
  );
}
