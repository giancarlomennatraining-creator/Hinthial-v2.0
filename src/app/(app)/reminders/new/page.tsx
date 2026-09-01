"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { CreateReminderForm } from "@/components/reminders/CreateReminderForm";

export default function NewReminderPage() {
  return (
    <RequireMasterKey>{(masterKey) => <CreateReminderForm masterKey={masterKey} />}</RequireMasterKey>
  );
}
