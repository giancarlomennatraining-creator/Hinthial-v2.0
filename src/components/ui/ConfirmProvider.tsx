"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./confirm-dialog.css";

export interface ConfirmOptions {
  /** Di cosa si tratta, in breve. Senza, "Sei sicuro?" per le azioni distruttive e "Conferma" per le altre. */
  title?: string;
  /** Cosa succede se si conferma, e se si può tornare indietro. Le righe a capo si rispettano. */
  message: ReactNode;
  /** Il verbo dell'azione ("Elimina", "Rimuovi"…), non un generico "Sì": chi legge deve capire cosa sta per fare. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Azione che non si disfa: il pulsante è rosso e il fuoco parte su "Annulla", così un Invio distratto non la fa. */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Al posto di `window.confirm`: una finestra dell'app, nello stile dell'app, che dice cosa succede e chiama l'azione con il
 * suo nome. `if (!(await confirm({ message, confirmLabel: "Elimina", danger: true }))) return;`. Dietro la finestra del
 * browser restava un vincolo: in un'app installata (o in un APK) è una finestra di sistema, fuori stile e senza modo di
 * dire "Elimina" invece di "OK".
 */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm va usato dentro <ConfirmProvider> (v. AppShell.tsx)");
  return confirm;
}

interface Pending {
  options: ConfirmOptions;
  resolve: (answer: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((input) => {
    const options = typeof input === "string" ? { message: input } : input;
    return new Promise<boolean>((resolve) => {
      // Una domanda nuova mentre un'altra è aperta: la vecchia resta senza risposta, cioè "no".
      setPending((previous) => {
        previous?.resolve(false);
        return { options, resolve };
      });
    });
  }, []);

  const answer = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  // Il fuoco: su "Annulla" se l'azione non si disfa, su "Conferma" altrimenti; e torna dov'era alla chiusura.
  const open = pending !== null;
  const danger = pending?.options.danger === true;
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (danger ? cancelRef.current : acceptRef.current)?.focus();
    return () => {
      before?.focus?.();
    };
  }, [open, danger]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      answer(false);
      return;
    }
    // Il fuoco resta dentro la finestra: due soli pulsanti, Tab li alterna.
    if (event.key === "Tab") {
      const first = cancelRef.current;
      const last = acceptRef.current;
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending ? (
        <div
          className="confirm-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) answer(false);
          }}
          onKeyDown={onKeyDown}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            className="confirm-panel flex w-full max-w-sm flex-col gap-4 surface-card rounded-card border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex flex-col gap-2">
              <h2 id={titleId} className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {pending.options.title ?? (danger ? "Sei sicuro?" : "Conferma")}
              </h2>
              <div id={messageId} className="text-sm whitespace-pre-line text-zinc-600 dark:text-zinc-400">
                {pending.options.message}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => answer(false)}
                className="rounded-btn border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {pending.options.cancelLabel ?? "Annulla"}
              </button>
              <button
                ref={acceptRef}
                type="button"
                data-confirm="accept"
                onClick={() => answer(true)}
                className={cn(
                  "rounded-btn px-4 py-2 text-sm font-semibold text-white",
                  danger ? "bg-red-600 hover:bg-red-700" : "bg-brand hover:bg-brand-hover",
                )}
              >
                {pending.options.confirmLabel ?? "Conferma"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}
