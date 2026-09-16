"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircleIcon } from "@/components/icons/nav-icons";
import { useMountedTransition } from "@/lib/use-mounted-transition";
import { cn } from "@/lib/utils";

interface ToastItem {
  id: number;
  message: string;
}

const ToastContext = createContext<((message: string) => void) | null>(null);

const TOAST_DURATION_MS = 3000;
const TRANSITION_MS = 200;

/**
 * Sostituisce i vecchi messaggi di conferma integrati nella pagina (v.
 * SuccessMessage, rimosso) con un popup in sovraimpressione, per
 * richiesta esplicita dell'utente --- creazione/modifica/chiusura/
 * condivisione riuscite non devono più spostare il layout della pagina
 * sotto di loro, solo apparire e sparire da sole sopra il resto.
 */
export function useToast(): (message: string) => void {
  const showToast = useContext(ToastContext);
  if (!showToast) {
    throw new Error("useToast va usato dentro <ToastProvider> (v. AppShell.tsx)");
  }
  return showToast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string) => {
    // Stesso testo già in coda (es. due "Bene creato." ravvicinati) --- non
    // se ne accoda un secondo identico, che si limiterebbe a sovrapporsi
    // visivamente al primo senza portare nessuna informazione in più.
    setToasts((prev) => {
      if (prev.some((toast) => toast.message === message)) return prev;
      return [...prev, { id: nextId.current++, message }];
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} onDone={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const [open, setOpen] = useState(true);
  const { mounted, entered } = useMountedTransition(open, TRANSITION_MS);

  useEffect(() => {
    const timeout = setTimeout(() => setOpen(false), TOAST_DURATION_MS);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!mounted) onDone();
  }, [mounted, onDone]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg transition-all duration-200 dark:bg-zinc-100 dark:text-zinc-900",
        entered ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
      )}
    >
      <CheckCircleIcon width={16} height={16} className="shrink-0 text-lime-400 dark:text-lime-600" />
      {message}
    </div>
  );
}
