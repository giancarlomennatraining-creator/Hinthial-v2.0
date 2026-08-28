"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { RemindersPanel } from "@/components/reminders/RemindersPanel";

export default function RemindersPage() {
  return (
    <RequireMasterKey>{(masterKey) => <RemindersPanel masterKey={masterKey} />}</RequireMasterKey>
  );
}
