"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { CreateCapsuleForm } from "@/components/capsules/CreateCapsuleForm";

export default function NewCapsulePage() {
  return (
    <RequireMasterKey>{(masterKey) => <CreateCapsuleForm masterKey={masterKey} />}</RequireMasterKey>
  );
}
