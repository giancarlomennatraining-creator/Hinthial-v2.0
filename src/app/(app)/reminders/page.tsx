"use client";

import { Suspense } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { RemindersPanel } from "@/components/reminders/RemindersPanel";

export default function RemindersPage() {
  return (
    <Suspense>
      <RequireMasterKey>{(masterKey) => <RemindersPanel masterKey={masterKey} />}</RequireMasterKey>
    </Suspense>
  );
}
