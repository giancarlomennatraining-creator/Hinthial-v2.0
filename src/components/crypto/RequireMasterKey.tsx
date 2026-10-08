"use client";

import { useEffect } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { LockedPlaceholder } from "@/components/crypto/LockedPlaceholder";
import { SetupMasterKeyForm } from "@/components/crypto/SetupMasterKeyForm";
import { useUnlockPrompt } from "@/components/crypto/UnlockPromptProvider";

/**
 * Gates its children behind an unlocked Master Key: shows the one-time setup form, or asks to unlock in a window
 * above the page (v. UnlockDialog), until then. Sections that don't encrypt anything (dashboard, settings, ...)
 * don't need this.
 */
export function RequireMasterKey({
  children,
}: {
  children: (masterKey: CryptoKey) => React.ReactNode;
}) {
  const { status } = useMasterKey();
  const { requestUnlock, settling } = useUnlockPrompt();

  // Senza la chiave questa pagina non ha nulla da mostrare: la finestra di sblocco si apre da sola e non si chiude finché non si sblocca.
  useEffect(() => {
    if (status.kind === "locked") requestUnlock({ dismissible: false });
  }, [status.kind, requestUnlock]);

  switch (status.kind) {
    case "checking":
      return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
    case "not-set-up":
      return <SetupMasterKeyForm />;
    case "locked":
      return <LockedPlaceholder />;
    case "unlocked":
      // Appena sbloccato la finestra si sta ancora dissolvendo: la pagina si popola dopo, non durante.
      return settling ? <LockedPlaceholder /> : <>{children(status.masterKey)}</>;
  }
}
