"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { CreateContactForm } from "@/components/contacts/CreateContactForm";

export default function NewContactPage() {
  return (
    <RequireMasterKey>{(masterKey) => <CreateContactForm masterKey={masterKey} />}</RequireMasterKey>
  );
}
