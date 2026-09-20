"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { SpendingTotalsPanel } from "@/components/documents/SpendingTotalsPanel";

export default function SpendingTotalsPage() {
  return (
    <RequireMasterKey>{(masterKey) => <SpendingTotalsPanel masterKey={masterKey} />}</RequireMasterKey>
  );
}
