"use client";

import { useMainNavItems } from "@/components/layout/MainNavItemsProvider";
import { NavItemsEditor } from "@/components/settings/NavItemsEditor";

/**
 * Impostazioni -> Aspetto: quali voci compaiono nella barra di navigazione generale (sidebar o barra orizzontale), e
 * in che ordine --- stesso editor della barra in basso (v. NavItemsEditor), ma senza un tetto massimo di voci: qui non
 * c'è un "altrove" dove ritrovare una voce tolta, quindi nessun limite artificiale di quante restare visibili.
 */
export function MainNavItemsSettings() {
  const { items, setItems } = useMainNavItems();
  return (
    <NavItemsEditor
      items={items}
      setItems={setItems}
      labels={{
        selectedHeading: "Visibili — in quest'ordine",
        emptyText: "Nessuna voce scelta — la barra di navigazione non compare.",
        availableHeading: "Nascoste",
        moveUp: (label) => `Sposta ${label} in alto`,
        moveDown: (label) => `Sposta ${label} in basso`,
        remove: (label) => `Nascondi ${label}`,
        footer:
          "Una voce nascosta qui non compare più nel menu principale — resta comunque raggiungibile dalla dashboard o dalla ricerca.",
      }}
    />
  );
}
