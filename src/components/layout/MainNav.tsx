"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";

/**
 * `collapsed` --- v. Sidebar: nasconde le etichette (restano lette dagli
 * screen reader) e centra le sole icone. `horizontal` --- v. TopNav: la
 * barra orizzontale non si comprime come la laterale, ma con 8 voci
 * mostra comunque solo le icone (etichetta in tooltip/screen reader),
 * altrimenti trabocca su schermi non larghissimi.
 */
export function MainNav({
  collapsed = false,
  horizontal = false,
}: {
  collapsed?: boolean;
  horizontal?: boolean;
}) {
  const pathname = usePathname();
  const iconOnly = collapsed || horizontal;

  return (
    <nav
      aria-label="Navigazione principale"
      className={horizontal ? "flex flex-wrap items-center gap-1" : "flex flex-col gap-1"}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            title={iconOnly ? item.label : undefined}
            className={cn(
              // Padding scritto per intero in ciascun ramo, mai come base +
              // override parziale (v. Sidebar.tsx per il perché: cn() qui
              // non è tailwind-merge, non fonde classi in conflitto).
              "flex items-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
              iconOnly ? "justify-center px-2" : "px-3",
              isActive
                ? "bg-brand text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
            )}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span className={iconOnly ? "sr-only" : undefined}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
