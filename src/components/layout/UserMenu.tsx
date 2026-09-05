"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth/actions";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

/**
 * The user's avatar + display name, opening a small menu with
 * "Impostazioni" e "Esci". `collapsed` --- v. Sidebar: nasconde solo il
 * nome (resta letto dagli screen reader) e la freccetta, l'avatar resta
 * sempre visibile. `menuPosition` --- v. TopNav: nella barra laterale il
 * pulsante è in fondo allo schermo, quindi il menu si apre verso l'alto
 * (default "up"); nella barra orizzontale è in cima, quindi va aperto
 * verso il basso ("down"), allineato al bordo destro per non uscire
 * dallo schermo essendo di solito l'elemento più a destra.
 */
export function UserMenu({
  userId,
  firstName,
  lastName,
  displayName,
  avatarUrl,
  collapsed = false,
  menuPosition = "up",
}: {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  collapsed?: boolean;
  menuPosition?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={collapsed ? displayName : undefined}
        className={cn(
          // Padding scritto per intero in ciascun ramo, mai come base +
          // override parziale (v. Sidebar.tsx per il perché: cn() qui non
          // è tailwind-merge, non fonde classi in conflitto --- con
          // "px-3" e "px-2" insieme nella stringa, chi vince dipende
          // dall'ordine con cui Tailwind genera il CSS, non da quello nel
          // className: era questo a far traboccare/tagliare l'avatar).
          "flex w-full items-center gap-2 rounded-md py-2 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-900",
          collapsed ? "justify-center px-2" : "justify-between px-3",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Avatar firstName={firstName} lastName={lastName} avatarUrl={avatarUrl} seed={userId} size="sm" />
          <span className={collapsed ? "sr-only" : "truncate"}>{displayName}</span>
        </span>
        {collapsed ? null : <span aria-hidden="true">{open ? "▴" : "▾"}</span>}
      </button>

      {open ? (
        <div
          className={cn(
            menuPosition === "down" ? "absolute right-0 top-full mt-1" : "absolute bottom-full left-0 mb-1",
            "w-full min-w-40 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950",
          )}
        >
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Impostazioni
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Esci
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
