"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { AIPanel } from "@/components/ai/AIPanel";

/**
 * Il render-prop di RequireMasterKey è una funzione --- non si può
 * passare da un Server Component (v. app/(app)/ai/page.tsx, che legge
 * il profilo con getCurrentUser()) direttamente a RequireMasterKey
 * (Client Component): RSC serializza solo dati, non funzioni. Questo
 * guscio client riceve solo stringhe/null dal Server Component e crea
 * la funzione qui, lato client.
 */
export function AIPage({
  userId,
  firstName,
  lastName,
  avatarUrl,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}) {
  return (
    <RequireMasterKey>
      {(masterKey) => (
        <AIPanel
          masterKey={masterKey}
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          avatarUrl={avatarUrl}
        />
      )}
    </RequireMasterKey>
  );
}
