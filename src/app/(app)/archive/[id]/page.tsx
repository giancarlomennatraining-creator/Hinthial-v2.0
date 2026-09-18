"use client";

import { use } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { ArchiveItemDetail } from "@/components/documents/ArchiveItemDetail";

export default function ArchiveItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireMasterKey>
      {(masterKey) => <ArchiveItemDetail masterKey={masterKey} documentId={id} />}
    </RequireMasterKey>
  );
}
