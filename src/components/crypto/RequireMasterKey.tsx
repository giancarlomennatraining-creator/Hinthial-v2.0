"use client";

import { useEffect } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { LockedPlaceholder } from "@/components/crypto/LockedPlaceholder";
import { useUnlockPrompt } from "@/components/crypto/UnlockPromptProvider";
import { BTN_PRIMARY } from "@/components/ui/styles";

/**
 * Gates its children behind an unlocked Master Key. Due modi:
 * - **a pagina intera** (predefinito): la pagina non ha nulla da mostrare senza la chiave, quindi la finestra di
 *   creazione (la prima volta) o di sblocco (v. SetupDialog, UnlockDialog) si apre da sola sopra uno scheletro e non si
 *   chiude finché non è fatto; c'è solo "Torna alla dashboard". Lasciando la pagina la finestra si ritira.
 * - **`inline`**: una sezione dentro una pagina che ha altro da mostrare (le Impostazioni): nessuna finestra
 *   automatica, che bloccherebbe il resto della pagina, ma un riquadro con il pulsante per crearla o sbloccarla.
 * Sezioni che non cifrano nulla (dashboard, la maggior parte delle Impostazioni, ...) non ne hanno bisogno.
 */
export function RequireMasterKey({
  children,
  inline = false,
}: {
  children: (masterKey: CryptoKey) => React.ReactNode;
  inline?: boolean;
}) {
  const { status } = useMasterKey();
  const { requestUnlock, requestSetup, releaseUnlock, closeUnlock, settling } = useUnlockPrompt();

  useEffect(() => {
    if (inline) return;
    if (status.kind === "locked") requestUnlock({ dismissible: false });
    if (status.kind === "not-set-up") requestSetup({ dismissible: false });
  }, [inline, status.kind, requestUnlock, requestSetup]);

  // Lasciando la pagina la finestra non resta sopra un'altra: a pagina intera si chiude comunque, in una sezione solo
  // se era stata aperta come chiudibile.
  useEffect(() => (inline ? releaseUnlock : closeUnlock), [inline, releaseUnlock, closeUnlock]);

  switch (status.kind) {
    case "checking":
      return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
    case "not-set-up":
    case "locked":
      return inline ? (
        <InlineNotice
          text={
            status.kind === "locked"
              ? "La cassaforte è bloccata: sbloccala per usare questa sezione."
              : "Per usare questa sezione serve prima la master password."
          }
          action={status.kind === "locked" ? "Sblocca ora" : "Crea la master password"}
          onAction={() =>
            status.kind === "locked" ? requestUnlock({ dismissible: true }) : requestSetup({ dismissible: true })
          }
        />
      ) : (
        <LockedPlaceholder />
      );
    case "unlocked":
      // Appena sbloccato la finestra si sta ancora dissolvendo: la pagina si popola dopo, non durante.
      return settling ? <LockedPlaceholder /> : <>{children(status.masterKey)}</>;
  }
}

function InlineNotice({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="min-w-0 flex-1 text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
      <button
        type="button"
        onClick={onAction}
        className={BTN_PRIMARY}
      >
        {action}
      </button>
    </div>
  );
}
