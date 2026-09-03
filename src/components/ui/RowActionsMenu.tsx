"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Un po' di margine da lasciare sotto il pannello prima di preferire aprirlo verso l'alto. */
const MIN_SPACE_BELOW = 220;

/**
 * Menu "⋮" per le azioni di una riga di lista (Modifica/Elimina/...) ---
 * stesso pattern a tendina di UserMenu (bottone + pannello, chiusura al
 * click fuori). Il pannello si chiude anche a un click al suo interno:
 * ogni azione (v. RowMenuItem) è un'operazione singola, non serve
 * tenerlo aperto dopo averla scelta.
 *
 * Il pannello va in un portal su document.body, posizionato in
 * `fixed` dalle coordinate reali del bottone --- non più un discendente
 * assoluto della riga: una tabella con `overflow-x-auto` (v. i pannelli
 * di lista) tronca verticalmente anche i discendenti assoluti che
 * escono dal proprio bordo (effetto collaterale di CSS: impostare
 * overflow-x forza anche overflow-y a "auto"), il che troncava il menu
 * sulle ultime righe. Si riposiziona solo all'apertura; se la pagina
 * scorre mentre è aperto si chiude (più semplice che inseguirla).
 */
export function RowActionsMenu({ label = "Azioni", children }: { label?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    // La posizione è calcolata una volta sola all'apertura (v. sopra):
    // se la pagina (o un contenitore con lo scroll proprio, es. la
    // tabella) scorre mentre il menu è aperto, si chiude invece di
    // restare disallineato dal bottone. `true` = cattura anche lo
    // scroll di un contenitore interno, non solo della finestra.
    function handleScroll() {
      setOpen(false);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open]);

  function toggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const right = window.innerWidth - rect.right;
      const spaceBelow = window.innerHeight - rect.bottom;
      setPosition(
        spaceBelow < MIN_SPACE_BELOW
          ? { bottom: window.innerHeight - rect.top + 4, right }
          : { top: rect.bottom + 4, right },
      );
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="rounded-md px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        <span aria-hidden="true">⋮</span>
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={label}
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                top: position.top,
                bottom: position.bottom,
                right: position.right,
              }}
              className="z-50 min-w-40 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Una voce del menu --- v. RowActionsMenu. `danger` per le azioni distruttive (Elimina). */
export function RowMenuItem({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "block w-full whitespace-nowrap px-3 py-2 text-left text-sm disabled:opacity-50",
        danger
          ? "text-red-600 hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-900"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
      )}
    >
      {children}
    </button>
  );
}
