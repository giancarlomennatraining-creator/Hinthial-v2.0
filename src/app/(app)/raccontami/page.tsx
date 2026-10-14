"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { RaccontamiPage } from "@/components/stories/RaccontamiPage";

export default function RaccontamiRoute() {
  return <RequireMasterKey>{(masterKey) => <RaccontamiPage masterKey={masterKey} />}</RequireMasterKey>;
}
