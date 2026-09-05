"use client";

import { useEffect, useState } from "react";
import { MainNav } from "@/components/layout/MainNav";
import { UserMenu } from "@/components/layout/UserMenu";
import { OnboardingStatus } from "@/components/layout/OnboardingStatus";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { getStoredSidebarCollapsed, storeSidebarCollapsed } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

/**
 * La barra laterale --- estratta da AppShell per poter tenere lo stato
 * di compressione (v. lib/sidebar.ts, solo su questo dispositivo, come
 * il tema). Compressa: solo icone nel menu e nell'avatar (nome ed
 * etichette restano comunque letti dagli screen reader, v. sr-only in
 * MainNav/UserMenu), logo al posto del lockup logo+scritta.
 */
export function Sidebar({
  userId,
  firstName,
  lastName,
  displayName,
  avatarUrl,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Legge una preferenza già decisa altrove (localStorage), non deriva
    // stato da props/state React.
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
        "flex flex-col gap-6 border-b border-zinc-200 md:shrink-0 md:border-b-0 md:border-r dark:border-zinc-800",
        // cn() qui non fonde classi in conflitto (v. lib/utils.ts, non è
        // tailwind-merge): il padding va scritto per intero in ciascun
        // ramo, mai come base + override parziale, altrimenti entrambi i
        // valori finiscono nella stringa e quale vince dipende dall'ordine
        // con cui Tailwind genera il CSS, non da quello nel className.
        // Compressa, meno padding: altrimenti a w-20 (80px) resta troppo
        // poco spazio e l'avatar (24px) trabocca invece di stare al centro.
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
      <MainNav collapsed={collapsed} />

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
