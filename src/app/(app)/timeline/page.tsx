"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { TimelinePanel } from "@/components/timeline/TimelinePanel";

export default function TimelinePage() {
  return <RequireMasterKey>{(masterKey) => <TimelinePanel masterKey={masterKey} />}</RequireMasterKey>;
}
