"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_HREFS, isNavItemActive, NAV_ITEMS } from "@/components/layout/nav-items";

/**
 * Barra fissa in basso su smartphone, con le cinque voci principali (v. BOTTOM_NAV_HREFS) --- le altre restano
 * raggiungibili dal menu con le 3 lineette (v. MobileNavBar, che le esclude da lì per non duplicarle).
 */
export function BottomNavBar() {
  const pathname = usePathname();
  const shownItems = BOTTOM_NAV_HREFS.map((href) => NAV_ITEMS.find((item) => item.href === href)).filter(
    (item): item is (typeof NAV_ITEMS)[number] => item !== undefined,
  );

  return (
    <nav
      aria-label="Navigazione rapida"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-zinc-800 dark:bg-zinc-950"
    >
      {shownItems.map((item) => {
        const isActive = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium",
              isActive ? "text-brand" : "text-zinc-500 dark:text-zinc-400",
            )}
          >
            <item.icon width={20} height={20} aria-hidden="true" className="text-brand" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
