import Link from "next/link";
import { MainNav } from "@/components/layout/MainNav";
import { UserMenu } from "@/components/layout/UserMenu";
import { OnboardingStatus } from "@/components/layout/OnboardingStatus";
import { GlobalSearch } from "@/components/search/GlobalSearch";

/**
 * Barra di navigazione orizzontale, alternativa alla barra laterale (v.
 * Sidebar) quando l'utente sceglie la disposizione "Orizzontale (in
 * alto)" in Impostazioni > Aspetto (v. NavOrientationProvider). A
 * differenza della barra laterale non si comprime/espande mai: logo
 * completo, voci con etichetta e ricerca per esteso restano sempre
 * visibili (va a capo su schermi stretti, v. flex-wrap sotto, invece di
 * comprimersi). Solo l'indicatore Onboarding resta ridotto alla sola
 * icona, per non affollare la barra.
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
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-zinc-200 p-4 dark:border-zinc-800">
      <Link href="/dashboard" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
        <img src="/brand/logo-lockup.svg" alt="HINTHIAL" className="h-8 w-auto" />
      </Link>

      <MainNav horizontal />

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
