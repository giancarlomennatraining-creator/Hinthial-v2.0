"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { useUnlockPrompt } from "@/components/crypto/UnlockPromptProvider";
import { signOut } from "@/lib/auth/actions";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

/**
 * Avatar + nome utente, apre un menu con "Impostazioni", "Blocca la cassaforte" (solo a cassaforte sbloccata) e "Esci". `collapsed`: nasconde nome e freccetta, l'avatar
 * resta visibile. `menuPosition`: nella barra laterale il pulsante è in fondo, il menu si apre verso l'alto
 * (default "up"); nella barra orizzontale è in cima, va aperto verso il basso ("down").
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
  const { status } = useMasterKey();
  const { lockNow } = useUnlockPrompt();
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
          // Padding scritto per intero in ciascun ramo, mai base + override parziale (v. Sidebar.tsx: cn() non è tailwind-merge).
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
          {status.kind === "unlocked" ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                lockNow();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Blocca la cassaforte
            </button>
          ) : null}
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
