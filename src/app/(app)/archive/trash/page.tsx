"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { TrashPanel } from "@/components/documents/TrashPanel";

export default function TrashPage() {
  return <RequireMasterKey>{(masterKey) => <TrashPanel masterKey={masterKey} />}</RequireMasterKey>;
}
