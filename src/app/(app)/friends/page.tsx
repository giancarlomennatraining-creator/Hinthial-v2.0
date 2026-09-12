"use client";

import { Suspense } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { FriendsPanel } from "@/components/friends/FriendsPanel";

export default function FriendsPage() {
  return (
    <Suspense>
      <RequireMasterKey>{(masterKey) => <FriendsPanel masterKey={masterKey} />}</RequireMasterKey>
    </Suspense>
  );
}
