"use client";

import { use } from "react";
import { PairingApprovalPanel } from "@/components/crypto/PairingApprovalPanel";

/**
 * FASE 13 --- dove porta il QR code mostrato dal dispositivo nuovo (v.
 * DevicePairingUnlock.tsx): niente RequireMasterKey qui, la pagina
 * gestisce da sé la propria richiesta della master password (v.
 * PairingApprovalPanel), sempre, anche a vault già sbloccato --- stessa
 * scelta di "Rendi fidato questo dispositivo" in Impostazioni.
 */
export default function PairPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  return <PairingApprovalPanel requestId={requestId} />;
}
