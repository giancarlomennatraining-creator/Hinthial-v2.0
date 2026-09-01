"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { DocumentsPanel } from "@/components/documents/DocumentsPanel";

export default function DocumentsPage() {
  return (
    <RequireMasterKey>{(masterKey) => <DocumentsPanel masterKey={masterKey} />}</RequireMasterKey>
  );
}
