"use client";

import Link from "next/link";
import { MainNav } from "@/components/layout/MainNav";
import { useOrderedNavItems } from "@/components/layout/MainNavItemsProvider";
import { UserMenu } from "@/components/layout/UserMenu";
import { OnboardingStatus } from "@/components/layout/OnboardingStatus";
import { GlobalSearch } from "@/components/search/GlobalSearch";

/**
 * Barra di navigazione orizzontale, alternativa a Sidebar quando l'utente sceglie "Orizzontale (in alto)" in
 * Impostazioni > Aspetto. A differenza della barra laterale non si comprime/espande mai: va a capo su schermi
 * stretti invece di comprimersi. Solo l'indicatore Onboarding resta ridotto alla sola icona.
 */
export function TopNav({
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
  const navItems = useOrderedNavItems();

  return (
    // Sotto md la sostituisce MobileNavBar. sticky top-0: senza, scorreva via con la pagina insieme al menu utente.
    <header className="sticky top-0 z-30 hidden flex-wrap items-center gap-4 border-b border-zinc-200 bg-white p-4 md:flex dark:border-zinc-800 dark:bg-zinc-950">
      <Link href="/dashboard" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
        <img src="/brand/logo-lockup.svg" alt="HINTHIAL" className="h-8 w-auto sm:h-10" />
      </Link>

      <MainNav horizontal items={navItems} />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <GlobalSearch />
        <OnboardingStatus collapsed />
        <UserMenu
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          displayName={displayName}
          avatarUrl={avatarUrl}
          menuPosition="down"
        />
      </div>
    </header>
  );
}
