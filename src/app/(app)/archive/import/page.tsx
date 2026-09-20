"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { BulkImportForm } from "@/components/documents/BulkImportForm";

export default function BulkImportPage() {
  return (
    <RequireMasterKey>{(masterKey) => <BulkImportForm masterKey={masterKey} />}</RequireMasterKey>
  );
}
