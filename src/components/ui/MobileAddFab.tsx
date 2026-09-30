"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface MobileAddFabMenuItem {
  href: string;
  label: string;
  icon: string;
  /** Una linea sopra la voce, per separare un gruppo (es. "Importa più file"). */
  separated?: boolean;
}

/**
 * Sotto `sm`, sostituisce il tasto "+ Aggiungi/Crea" dell'intestazione con un "+" tondo fisso sopra BottomNavBar.
 * Senza `menu` porta alla pagina di creazione; con `menu` apre le stesse scelte del tasto desktop.
 * I chiamanti riservano un padding-bottom aggiuntivo (`pb-[calc(3rem+...)] sm:pb-0`)
 * così l'ultima riga di lista non finisce sotto al FAB, intercettando il suo tasto "⋮" (v. RowActionsMenu).
 * "Aggiuntivo" perché `<main>` riserva già 6rem sotto `md` per BottomNavBar: il padding qui copre solo la differenza
 * fino agli 8.5rem reali del FAB, non l'intero spazio da zero (altrimenti le due riserve si sommerebbero).
 */
export function MobileAddFab({
  href,
  label,
  menu,
}: {
  href: string;
  label: string;
  menu?: MobileAddFabMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  const buttonClassName =
    "flex h-14 w-14 items-center justify-center rounded-full bg-brand text-3xl leading-none font-light text-white shadow-lg hover:bg-brand-hover";

  if (!menu) {
    return (
      <Link
        href={href}
        aria-label={label}
        className={`fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 sm:hidden ${buttonClassName}`}
      >
        +
      </Link>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 sm:hidden"
    >
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 bottom-full mb-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          {menu.map((item) => (
            <div key={item.href}>
              {item.separated ? <div className="my-1 border-t border-zinc-100 dark:border-zinc-900" /> : null}
              <Link
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <span aria-hidden="true">{item.icon}</span> {item.label}
              </Link>
            </div>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className={buttonClassName}
      >
        <span aria-hidden="true" className={open ? "rotate-45 transition-transform" : "transition-transform"}>
          +
        </span>
      </button>
    </div>
  );
}
