"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { UnlockDialog } from "@/components/crypto/UnlockDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { createClient } from "@/lib/db/supabase/client";
import { updateUnlockStyle } from "@/domain/profile/repository";
import type { UnlockStyle } from "@/lib/unlock-style";

interface RequestOptions {
  /** Si può chiudere con Esc o "Più tardi" (la Dashboard); altrimenti resta finché non si sblocca (le pagine che servono la chiave). */
  dismissible?: boolean;
  /** Chiamata quando la si chiude senza sbloccare. */
  onDismiss?: () => void;
}

interface UnlockPromptContextValue {
  /** Lo stile scelto in Impostazioni > Aspetto > Sblocco. */
  style: UnlockStyle;
  setStyle: (next: UnlockStyle) => Promise<void>;
  /** Apre la finestra di sblocco, se il vault è bloccato (altrimenti non fa nulla). Se è già aperta come chiudibile e chi chiede ora non la vuole chiudibile, diventa non chiudibile. */
  requestUnlock: (options?: RequestOptions) => void;
  /** Chi aveva aperto la finestra come chiudibile (la Dashboard) la ritira quando esce di scena: non deve restare sopra un'altra pagina. */
  releaseUnlock: () => void;
  /** Mostra una pelle in anteprima, senza sbloccare nulla (per le Impostazioni). */
  preview: (style: UnlockStyle) => void;
}

const UnlockPromptContext = createContext<UnlockPromptContextValue | null>(null);

interface OpenPrompt {
  dismissible: boolean;
  onDismiss?: () => void;
}

/**
 * Tiene la finestra di sblocco (v. UnlockDialog) in un unico posto, sopra tutta l'app: chi ne ha bisogno la chiede con
 * `requestUnlock`, e lei resta aperta durante l'animazione di uscita anche se il vault è già sbloccato. Conserva anche lo
 * stile scelto, sincronizzato sul server (profiles.unlock_style), noto già al primo render come la disposizione del menu.
 */
export function UnlockPromptProvider({
  userId,
  initialStyle,
  children,
}: {
  userId: string;
  initialStyle: UnlockStyle;
  children: React.ReactNode;
}) {
  const { status } = useMasterKey();
  const showToast = useToast();
  const [style, setStyleState] = useState<UnlockStyle>(initialStyle);
  const [prompt, setPrompt] = useState<OpenPrompt | null>(null);
  const [previewStyle, setPreviewStyle] = useState<UnlockStyle | null>(null);

  const setStyle = useCallback(
    async (next: UnlockStyle) => {
      const previous = style;
      setStyleState(next); // ottimistico: la scheda risponde subito
      try {
        await updateUnlockStyle(createClient(), userId, next);
      } catch (err) {
        setStyleState(previous);
        throw err;
      }
    },
    [style, userId],
  );

  // Dipende dallo stato: chi la chiama da un effetto (la Dashboard, RequireMasterKey) ne riceve una nuova non appena il vault risulta bloccato.
  const statusKind = status.kind;
  const requestUnlock = useCallback(
    (options?: RequestOptions) => {
      if (statusKind !== "locked") return;
      const dismissible = options?.dismissible ?? false;
      setPrompt((current) => {
        if (!current) return { dismissible, onDismiss: options?.onDismiss };
        // Una pagina che serve la chiave vince su una finestra aperta come chiudibile: non si può più chiudere.
        return current.dismissible && !dismissible ? { dismissible: false } : current;
      });
    },
    [statusKind],
  );

  const releaseUnlock = useCallback(() => setPrompt((current) => (current?.dismissible ? null : current)), []);

  const preview = useCallback((next: UnlockStyle) => setPreviewStyle(next), []);

  const value = useMemo<UnlockPromptContextValue>(
    () => ({ style, setStyle, requestUnlock, releaseUnlock, preview }),
    [style, setStyle, requestUnlock, releaseUnlock, preview],
  );

  return (
    <UnlockPromptContext.Provider value={value}>
      {children}
      {previewStyle ? (
        <UnlockDialog
          style={previewStyle}
          demo
          dismissible
          onDismiss={() => setPreviewStyle(null)}
          onDone={() => setPreviewStyle(null)}
        />
      ) : prompt ? (
        <UnlockDialog
          style={style}
          demo={false}
          dismissible={prompt.dismissible}
          onDismiss={() => {
            prompt.onDismiss?.();
            // Solo se è ancora chiudibile: una pagina che serve la chiave può averla resa non chiudibile un attimo prima del tocco.
            setPrompt((current) => (current?.dismissible ? null : current));
          }}
          onDone={() => {
            setPrompt(null);
            showToast("Cassaforte sbloccata.");
          }}
        />
      ) : null}
    </UnlockPromptContext.Provider>
  );
}

export function useUnlockPrompt(): UnlockPromptContextValue {
  const ctx = useContext(UnlockPromptContext);
  if (!ctx) {
    throw new Error("useUnlockPrompt must be used within an UnlockPromptProvider");
  }
  return ctx;
}
