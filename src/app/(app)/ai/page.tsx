"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { AIPanel } from "@/components/ai/AIPanel";

export default function AiPage() {
  return <RequireMasterKey>{(masterKey) => <AIPanel masterKey={masterKey} />}</RequireMasterKey>;
}
