"use client";

import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { SetupMasterKeyForm } from "@/components/crypto/SetupMasterKeyForm";
import { UnlockMasterKeyForm } from "@/components/crypto/UnlockMasterKeyForm";

/**
 * Gates its children behind an unlocked Master Key: shows the one-time
 * setup form, or the unlock form, until then. Sections that don't
 * encrypt anything (dashboard, settings, ...) don't need this.
 */
export function RequireMasterKey({
  children,
}: {
  children: (masterKey: CryptoKey) => React.ReactNode;
}) {
  const { status } = useMasterKey();

  switch (status.kind) {
    case "checking":
      return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
    case "not-set-up":
      return <SetupMasterKeyForm />;
    case "locked":
      return <UnlockMasterKeyForm />;
    case "unlocked":
      return <>{children(status.masterKey)}</>;
  }
}
