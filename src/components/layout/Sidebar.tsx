"use client";

import { useEffect, useState } from "react";
import { MainNav } from "@/components/layout/MainNav";
import { useOrderedNavItems } from "@/components/layout/MainNavItemsProvider";
import { UserMenu } from "@/components/layout/UserMenu";
import { OnboardingStatus } from "@/components/layout/OnboardingStatus";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { getStoredSidebarCollapsed, storeSidebarCollapsed } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

/**
 * La barra laterale, con stato di compressione persistito solo su questo dispositivo (v. lib/sidebar.ts). Compressa:
 * solo icone (nome ed etichette restano letti dagli screen reader, v. sr-only in MainNav/UserMenu), logo senza scritta.
 * `side`: solo per scegliere il bordo di confine col contenuto --- l'ordine visivo lo decide AppShell.
 */
export function Sidebar({
  userId,
  firstName,
  lastName,
  displayName,
  avatarUrl,
  side = "left",
}: {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  side?: "left" | "right";
}) {
  const [collapsed, setCollapsed] = useState(false);
  const navItems = useOrderedNavItems();

  useEffect(() => {
    // Legge una preferenza già decisa altrove (localStorage), non deriva stato da props/state React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(getStoredSidebarCollapsed());
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    storeSidebarCollapsed(next);
  }

  return (
    <aside
      className={cn(
        // Sotto md la sostituisce MobileNavBar (v. AppShell): resta montata, solo nascosta, per non perdere lo stato di compressione attraversando la soglia md.
        // md:sticky md:top-0 md:h-screen: senza, <aside> seguiva l'altezza di <main> e l'avatar in fondo finiva irraggiungibile su pagine lunghe.
        "hidden flex-col gap-6 overflow-x-hidden overflow-y-auto border-b border-zinc-200 bg-white transition-[width,padding] duration-300 ease-in-out md:sticky md:top-0 md:flex md:h-screen md:shrink-0 md:border-b-0 dark:border-zinc-800 dark:bg-zinc-950",
        side === "right" ? "md:order-2 md:border-l" : "md:border-r",
        // cn() non fonde classi in conflitto (v. lib/utils.ts): il padding va scritto per intero in ciascun ramo, mai base + override parziale.
        collapsed ? "p-3 md:w-20" : "p-4 md:w-56 md:p-6",
      )}
    >
      <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "justify-between px-3")}>
        <span className={collapsed ? "" : "min-w-0"}>
          {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
          <img
            src={collapsed ? "/brand/logo.svg" : "/brand/logo-lockup.svg"}
            alt="HINTHIAL"
            className={collapsed ? "h-8 w-8" : "h-auto w-full"}
          />
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Espandi il menu" : "Comprimi il menu"}
          title={collapsed ? "Espandi il menu" : "Comprimi il menu"}
          className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
        </button>
      </div>

      <GlobalSearch collapsed={collapsed} />
      <MainNav collapsed={collapsed} items={navItems} />

      <div className="mt-auto flex flex-col gap-2">
        <OnboardingStatus collapsed={collapsed} />
        <UserMenu
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          displayName={displayName}
          avatarUrl={avatarUrl}
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}
