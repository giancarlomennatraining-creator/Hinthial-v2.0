"use client";

import { createPortal } from "react-dom";
import { useMountedTransition } from "@/lib/use-mounted-transition";
import { cn } from "@/lib/utils";

/**
 * Il pannello laterale a tutto schermo, ancorato al bordo destro ---
 * stesso pattern in OnboardingStatus e AuditLogPanel (dettaglio
 * attività), estratto qui per non avere due copie della stessa
 * animazione di entrata/uscita (v. richiesta utente): il pannello
 * scorre dentro da destra, lo sfondo scurito compare/scompare insieme
 * ad esso, invece di comparire/sparire di scatto. Ogni chiamante
 * mantiene il proprio contenuto/intestazione/tasto di chiusura --- qui
 * c'è solo l'involucro (overlay, animazione, portale, chiusura al click
 * fuori/Escape la gestisce già il chiamante).
 */
export function SidePanel({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const { mounted, entered } = useMountedTransition(open, 300);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 bg-black/40 transition-opacity duration-300",
        entered ? "opacity-100" : "opacity-0",
      )}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-sm flex-col gap-4 overflow-y-auto border-l border-zinc-200 bg-white p-6 shadow-xl transition-transform duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950",
          entered ? "translate-x-0" : "translate-x-full",
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
