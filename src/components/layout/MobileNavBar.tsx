"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MainNav } from "@/components/layout/MainNav";
import { UserMenu } from "@/components/layout/UserMenu";
import { OnboardingStatus } from "@/components/layout/OnboardingStatus";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { useBottomNavItems } from "@/components/layout/BottomNavItemsProvider";
import { useOrderedNavItems } from "@/components/layout/MainNavItemsProvider";
import { useMountedTransition } from "@/lib/use-mounted-transition";
import { cn } from "@/lib/utils";

/**
 * Su schermi piccoli (sotto md) sostituisce sia la barra laterale (v.
 * Sidebar) sia quella orizzontale (v. TopNav) --- qualunque disposizione
 * sia scelta in Impostazioni > Aspetto, sotto md non c'è spazio per
 * tenerla sempre visibile: solo logo + tasto menu, che apre lo stesso
 * contenuto (ricerca, navigazione, onboarding, utente) in sovraimpressione.
 * Sidebar/TopNav restano montate (nascoste con `hidden md:flex`, v.
 * AppShell) invece di scegliere qui: così lo stato di compressione della
 * barra laterale non si perde passando sopra/sotto la soglia md.
 */
export function MobileNavBar({
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { mounted, entered } = useMountedTransition(open, 300);
  const { items: bottomNavItems } = useBottomNavItems();

  // Le voci già raggiungibili dalla barra fissa in basso (v. BottomNavBar)
  // non vanno ripetute qui --- solo il resto, come chiesto dall'utente.
  const navItems = useOrderedNavItems();
  const drawerItems = navItems.filter((item) => !bottomNavItems.includes(item.href));

  // Una navigazione riuscita chiude il menu --- altrimenti resterebbe
  // aperto sopra la nuova pagina.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- v. GlobalSearch.tsx per lo stesso pattern (si azzera uno stato in risposta a un cambiamento esterno, il pathname).
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      {/*
        Un <div>, non <header>: nella disposizione orizzontale c'è già un
        <header> vero e proprio (v. TopNav), il landmark "banner" della
        pagina --- un secondo <header> qui (anche se nascosto via CSS sopra
        md) lo duplicherebbe, rendendo ambiguo cosa sia "il" banner.
      */}
      {/*
        sticky top-0 --- senza, questa barra (col tasto ☰) scorreva via
        con il resto della pagina come qualunque altro contenuto: su una
        pagina più lunga di una schermata, bastava scorrere un po' perché
        il tasto per aprire il menu finisse fuori vista, toccando "il
        vuoto" a quel punto della pagina invece del tasto vero (v.
        segnalazione utente). z-30, sotto i z-40/z-50 di barra in basso e
        finestre di sovraimpressione, così non le copre mai.
      */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white p-3 md:hidden dark:border-zinc-800 dark:bg-zinc-950">
        <Link href="/dashboard" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
          <img src="/brand/logo-lockup.svg" alt="HINTHIAL" className="h-8 w-auto" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Apri il menu"
          aria-expanded={open}
          className="shrink-0 rounded-md p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <span aria-hidden="true" className="block text-xl leading-none">
            ☰
          </span>
        </button>
      </div>

      {mounted ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className={cn(
              "absolute inset-0 bg-black/40 transition-opacity duration-300",
              entered ? "opacity-100" : "opacity-0",
            )}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu di navigazione"
            className={cn(
              "relative flex h-full w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-white p-4 shadow-xl transition-transform duration-300 ease-out dark:bg-zinc-950",
              entered ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div className="flex items-center justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
              <img src="/brand/logo-lockup.svg" alt="HINTHIAL" className="h-8 w-auto" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Chiudi il menu"
                className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <GlobalSearch />
            <MainNav items={drawerItems} />

            <div className="mt-auto flex flex-col gap-2">
              <OnboardingStatus />
              <UserMenu
                userId={userId}
                firstName={firstName}
                lastName={lastName}
                displayName={displayName}
                avatarUrl={avatarUrl}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
