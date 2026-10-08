"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { SetupDialog } from "@/components/crypto/SetupDialog";
import { UnlockDialog } from "@/components/crypto/UnlockDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { createClient } from "@/lib/db/supabase/client";
import { updateUnlockStyle } from "@/domain/profile/repository";
import type { UnlockStyle } from "@/lib/unlock-style";

/** La finestra chiusa con "Più tardi" non si riapre da sola in questa sessione del browser (le pagine che servono la chiave la riaprono comunque). */
const UNLOCK_DISMISSED_KEY = "hinthial.unlock-dismissed";

export function unlockWasDismissed(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberUnlockDismissed() {
  try {
    sessionStorage.setItem(UNLOCK_DISMISSED_KEY, "1");
  } catch {
    // Senza storage la finestra si riaprirà alla prossima visita: non grave.
  }
}

function clearUnlockDismissed() {
  try {
    sessionStorage.removeItem(UNLOCK_DISMISSED_KEY);
  } catch {
    // Niente da togliere.
  }
}

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
  /** Apre la finestra di creazione della master password, se non è ancora stata creata (altrimenti non fa nulla). Stesse regole di `requestUnlock`. */
  requestSetup: (options?: RequestOptions) => void;
  /** Blocca la cassaforte adesso (dal menu utente): torna da sbloccare, e la finestra si riapre dove serve. */
  lockNow: () => void;
  /** Vero dallo sblocco riuscito fino alla fine dell'animazione di uscita: il vault è già sbloccato ma la pagina non deve ancora popolarsi, solo quando la finestra è sparita. */
  settling: boolean;
  /** Chi aveva aperto la finestra come chiudibile (la Dashboard) la ritira quando esce di scena: non deve restare sopra un'altra pagina. */
  releaseUnlock: () => void;
  /** Chiude la finestra comunque sia stata aperta: una pagina a intera che serve la chiave la ritira quando la si lascia. */
  closeUnlock: () => void;
  /** La finestra di creazione della master password è aperta: il popup di benvenuto non deve stare sopra o sotto di lei. */
  setupOpen: boolean;
  /** Mostra una pelle in anteprima, senza sbloccare nulla (per le Impostazioni). */
  preview: (style: UnlockStyle) => void;
}

const UnlockPromptContext = createContext<UnlockPromptContextValue | null>(null);

interface OpenPrompt {
  /** Sbloccare un vault che c'è, o crearne uno che ancora non c'è. */
  kind: "unlock" | "setup";
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
  const { status, lock } = useMasterKey();
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
  const request = useCallback((kind: OpenPrompt["kind"], options?: RequestOptions) => {
    const dismissible = options?.dismissible ?? false;
    setPrompt((current) => {
      if (!current) return { kind, dismissible, onDismiss: options?.onDismiss };
      // Una pagina che serve la chiave vince su una finestra aperta come chiudibile: non si può più chiudere.
      return current.dismissible && !dismissible ? { kind: current.kind, dismissible: false } : current;
    });
  }, []);

  const requestUnlock = useCallback(
    (options?: RequestOptions) => {
      if (statusKind === "locked") request("unlock", options);
    },
    [statusKind, request],
  );

  const requestSetup = useCallback(
    (options?: RequestOptions) => {
      if (statusKind === "not-set-up") request("setup", options);
    },
    [statusKind, request],
  );

  // La finestra resta montata durante l'animazione di uscita: finché c'è, e il vault è già sbloccato, si sta chiudendo.
  const settling = prompt !== null && status.kind === "unlocked";

  const lockNow = useCallback(() => {
    // Un blocco voluto non deve restare ignorato perché prima si era scelto "Più tardi" sulla dashboard.
    clearUnlockDismissed();
    lock();
    showToast("Cassaforte bloccata.");
  }, [lock, showToast]);

  const closeUnlock = useCallback(() => setPrompt(null), []);
  const setupOpen = prompt?.kind === "setup";

  const releaseUnlock = useCallback(() => setPrompt((current) => (current?.dismissible ? null : current)), []);

  const preview = useCallback((next: UnlockStyle) => setPreviewStyle(next), []);

  const value = useMemo<UnlockPromptContextValue>(
    () => ({ style, setStyle, requestUnlock, requestSetup, releaseUnlock, closeUnlock, setupOpen, lockNow, settling, preview }),
    [style, setStyle, requestUnlock, requestSetup, releaseUnlock, closeUnlock, setupOpen, lockNow, settling, preview],
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
      ) : prompt?.kind === "setup" ? (
        <SetupDialog
          style={style}
          dismissible={prompt.dismissible}
          leaveHref={prompt.dismissible ? undefined : "/dashboard"}
          onDismiss={() => {
            prompt.onDismiss?.();
            setPrompt((current) => (current?.dismissible ? null : current));
          }}
          onDone={() => {
            setPrompt(null);
            showToast("Master password creata.");
          }}
        />
      ) : prompt ? (
        <UnlockDialog
          style={style}
          demo={false}
          dismissible={prompt.dismissible}
          leaveHref={prompt.dismissible ? undefined : "/dashboard"}
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
