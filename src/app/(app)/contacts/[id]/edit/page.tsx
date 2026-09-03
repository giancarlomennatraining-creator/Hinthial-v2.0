"use client";

import { use } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { EditContactForm } from "@/components/contacts/EditContactForm";

export default function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireMasterKey>
      {(masterKey) => <EditContactForm masterKey={masterKey} contactId={id} />}
    </RequireMasterKey>
  );
}
