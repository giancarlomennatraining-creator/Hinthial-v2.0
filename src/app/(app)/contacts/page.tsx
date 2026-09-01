"use client";

import { Suspense } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { TrustedContactsPanel } from "@/components/contacts/TrustedContactsPanel";

export default function ContactsPage() {
  return (
    <Suspense>
      <RequireMasterKey>
        {(masterKey) => <TrustedContactsPanel masterKey={masterKey} />}
      </RequireMasterKey>
    </Suspense>
  );
}
