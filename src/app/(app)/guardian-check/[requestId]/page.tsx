"use client";

import { use } from "react";
import { GuardianVerificationPanel } from "@/components/digital-legacy/GuardianVerificationPanel";

/**
 * FASE 12 --- dove porta il link nell'email di richiesta a un guardiano
 * (v. lib/email/templates.ts, digitalLegacyGuardianRequestEmail). Vive
 * sotto (app), quindi richiede già un login (v. (app)/layout.tsx) ---
 * un click a freddo, senza sessione, rimanda prima a /login.
 */
export default function GuardianCheckPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  return <GuardianVerificationPanel requestId={requestId} />;
}
