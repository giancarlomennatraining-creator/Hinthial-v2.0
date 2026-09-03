"use client";

import { use } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { EditAssetForm } from "@/components/assets/EditAssetForm";

export default function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RequireMasterKey>{(masterKey) => <EditAssetForm masterKey={masterKey} assetId={id} />}</RequireMasterKey>;
}
