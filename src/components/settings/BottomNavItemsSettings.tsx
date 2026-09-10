"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useBottomNavItems } from "@/components/layout/BottomNavItemsProvider";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { MAX_BOTTOM_NAV_ITEMS } from "@/lib/bottom-nav";

/**
 * Impostazioni -> Aspetto: quali voci compaiono nella barra fissa in
 * basso su smartphone (v. BottomNavBar) --- le altre restano comunque
 * raggiungibili dal menu con le 3 lineette (v. MobileNavBar). Fino a
 * MAX_BOTTOM_NAV_ITEMS scelte, altrimenti la barra diventerebbe troppo
 * stretta per restare leggibile.
 */
export function BottomNavItemsSettings() {
  const { items, setItems } = useBottomNavItems();
  const [error, setError] = useState(false);

  async function toggle(href: string) {
    setError(false);
    const checked = items.includes(href);
    if (!checked && items.length >= MAX_BOTTOM_NAV_ITEMS) return;

    const next = checked ? items.filter((h) => h !== href) : [...items, href];
    try {
      await setItems(next);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1 rounded-md border border-zinc-300 p-1 dark:border-zinc-700">
        {NAV_ITEMS.map((item) => {
          const checked = items.includes(item.href);
          const disabled = !checked && items.length >= MAX_BOTTOM_NAV_ITEMS;
          return (
            <li key={item.href}>
              <label
                className={cn(
                  "flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium",
                  disabled
                    ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
                    : "cursor-pointer text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(item.href)}
                  className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
                />
                {item.label}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Fino a {MAX_BOTTOM_NAV_ITEMS} voci --- le altre restano nel menu con le 3 lineette.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          Preferenza non salvata.
        </p>
      ) : null}
    </div>
  );
}
