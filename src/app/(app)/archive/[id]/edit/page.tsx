"use client";

import { use } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { EditArchiveItemForm } from "@/components/documents/EditArchiveItemForm";

export default function EditArchiveItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireMasterKey>
      {(masterKey) => <EditArchiveItemForm masterKey={masterKey} documentId={id} />}
    </RequireMasterKey>
  );
}
