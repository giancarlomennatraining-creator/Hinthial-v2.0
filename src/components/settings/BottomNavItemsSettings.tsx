"use client";

import { useBottomNavItems } from "@/components/layout/BottomNavItemsProvider";
import { NavItemsEditor } from "@/components/settings/NavItemsEditor";
import { MAX_BOTTOM_NAV_ITEMS } from "@/lib/bottom-nav";

/**
 * Impostazioni -> Aspetto: quali voci compaiono nella barra fissa in basso su smartphone (v. BottomNavBar), in che
 * ordine --- le altre restano comunque raggiungibili dal menu con le 3 lineette. Fino a MAX_BOTTOM_NAV_ITEMS scelte,
 * altrimenti la barra diventerebbe troppo stretta per restare leggibile.
 */
export function BottomNavItemsSettings() {
  const { items, setItems } = useBottomNavItems();
  return (
    <NavItemsEditor
      items={items}
      setItems={setItems}
      max={MAX_BOTTOM_NAV_ITEMS}
      labels={{
        selectedHeading: "Nella barra — in quest'ordine",
        emptyText: "Nessuna voce scelta — la barra in basso non compare.",
        availableHeading: "Altre voci",
        moveUp: (label) => `Sposta ${label} in alto nella barra`,
        moveDown: (label) => `Sposta ${label} in basso nella barra`,
        remove: (label) => `Togli ${label} dalla barra`,
        footer: `Fino a ${MAX_BOTTOM_NAV_ITEMS} voci — le altre restano nel menu con le 3 lineette.`,
      }}
    />
  );
}
