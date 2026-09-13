"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { updateMainNavItems } from "@/domain/profile/repository";
import { NAV_ITEMS, type NavItem } from "@/components/layout/nav-items";
import type { MainNavItems } from "@/lib/main-nav";

interface MainNavItemsContextValue {
  items: MainNavItems;
  setItems: (next: MainNavItems) => Promise<void>;
}

const MainNavItemsContext = createContext<MainNavItemsContextValue | null>(null);

/**
 * Quali voci di NAV_ITEMS mostrare nella barra di navigazione generale
 * (sidebar/topbar, v. Sidebar/TopNav/MobileNavBar), e in che ordine ---
 * sincronizzata sul server (profiles.main_nav_items), come
 * BottomNavItemsProvider: il valore iniziale arriva già letto lato
 * server, per evitare un lampo delle voci sbagliate al primo render.
 */
export function MainNavItemsProvider({
  userId,
  initialItems,
  children,
}: {
  userId: string;
  initialItems: MainNavItems;
  children: React.ReactNode;
}) {
  const [items, setItemsState] = useState<MainNavItems>(initialItems);

  const setItems = useCallback(
    async (next: MainNavItems) => {
      const previous = items;
      setItemsState(next); // optimistic: la barra cambia subito

      try {
        const supabase = createClient();
        await updateMainNavItems(supabase, userId, next);
      } catch (err) {
        setItemsState(previous); // il server non ha salvato: si torna indietro
        throw err;
      }
    },
    [items, userId],
  );

  const value = useMemo<MainNavItemsContextValue>(() => ({ items, setItems }), [items, setItems]);

  return <MainNavItemsContext.Provider value={value}>{children}</MainNavItemsContext.Provider>;
}

export function useMainNavItems(): MainNavItemsContextValue {
  const ctx = useContext(MainNavItemsContext);
  if (!ctx) {
    throw new Error("useMainNavItems must be used within a MainNavItemsProvider");
  }
  return ctx;
}

/** NAV_ITEMS filtrati/ordinati secondo la preferenza --- usato da Sidebar/TopNav (l'intero elenco visibile) e da MobileNavBar (il cassetto, ulteriormente meno le voci già nella barra in basso). */
export function useOrderedNavItems(): NavItem[] {
  const { items } = useMainNavItems();
  return items
    .map((href) => NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is NavItem => item !== undefined);
}
