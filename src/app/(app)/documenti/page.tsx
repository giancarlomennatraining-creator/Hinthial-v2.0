"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { DocumentiPanel } from "@/components/documenti/DocumentiPanel";

export default function DocumentiPage() {
  return (
    <RequireMasterKey>{(masterKey) => <DocumentiPanel masterKey={masterKey} />}</RequireMasterKey>
  );
}
