"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { ConfirmImport } from "@/components/documents/ConfirmImport";

export default function ConfirmImportPage() {
  return <RequireMasterKey>{(masterKey) => <ConfirmImport masterKey={masterKey} />}</RequireMasterKey>;
}
