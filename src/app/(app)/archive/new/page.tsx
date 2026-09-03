"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { CreateArchiveItemForm } from "@/components/documents/CreateArchiveItemForm";

export default function NewArchiveItemPage() {
  return (
    <RequireMasterKey>{(masterKey) => <CreateArchiveItemForm masterKey={masterKey} />}</RequireMasterKey>
  );
}
