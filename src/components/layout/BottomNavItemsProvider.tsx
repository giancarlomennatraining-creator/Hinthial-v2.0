"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { updateBottomNavItems } from "@/domain/profile/repository";
import type { BottomNavItems } from "@/lib/bottom-nav";

interface BottomNavItemsContextValue {
  items: BottomNavItems;
  setItems: (next: BottomNavItems) => Promise<void>;
}

const BottomNavItemsContext = createContext<BottomNavItemsContextValue | null>(null);

/**
 * Voci di NAV_ITEMS mostrate nella barra fissa in basso su smartphone
 * (v. BottomNavBar) --- le altre restano raggiungibili dal menu con le
 * 3 lineette (v. MobileNavBar, che le esclude da lì). Sincronizzata sul
 * server (profiles.bottom_nav_items), come la disposizione del menu
 * (v. NavOrientationProvider): il valore iniziale arriva già letto lato
 * server, per evitare un lampo delle icone sbagliate al primo render
 * della shell autenticata.
 */
export function BottomNavItemsProvider({
  userId,
  initialItems,
  children,
}: {
  userId: string;
  initialItems: BottomNavItems;
  children: React.ReactNode;
}) {
  const [items, setItemsState] = useState<BottomNavItems>(initialItems);

  const setItems = useCallback(
    async (next: BottomNavItems) => {
      const previous = items;
      setItemsState(next); // optimistic: la barra cambia subito

      try {
        const supabase = createClient();
        await updateBottomNavItems(supabase, userId, next);
      } catch (err) {
        setItemsState(previous); // il server non ha salvato: si torna indietro
        throw err;
      }
    },
    [items, userId],
  );

  const value = useMemo<BottomNavItemsContextValue>(() => ({ items, setItems }), [items, setItems]);

  return <BottomNavItemsContext.Provider value={value}>{children}</BottomNavItemsContext.Provider>;
}

export function useBottomNavItems(): BottomNavItemsContextValue {
  const ctx = useContext(BottomNavItemsContext);
  if (!ctx) {
    throw new Error("useBottomNavItems must be used within a BottomNavItemsProvider");
  }
  return ctx;
}
