"use client";

import { use } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { EditCapsuleForm } from "@/components/capsules/EditCapsuleForm";

export default function EditCapsulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireMasterKey>
      {(masterKey) => <EditCapsuleForm masterKey={masterKey} capsuleId={id} />}
    </RequireMasterKey>
  );
}
