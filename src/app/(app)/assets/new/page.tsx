"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { CreateAssetForm } from "@/components/assets/CreateAssetForm";

export default function NewAssetPage() {
  return <RequireMasterKey>{(masterKey) => <CreateAssetForm masterKey={masterKey} />}</RequireMasterKey>;
}
