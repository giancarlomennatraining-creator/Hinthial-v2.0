"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MainNav } from "@/components/layout/MainNav";
import { UserMenu } from "@/components/layout/UserMenu";
import { PlanStatus } from "@/components/layout/PlanStatus";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { BOTTOM_NAV_HREFS, NAV_ITEMS } from "@/components/layout/nav-items";
import { useMountedTransition } from "@/lib/use-mounted-transition";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/components/layout/BrandLockup";

/**
 * Su schermi piccoli sostituisce Sidebar con solo logo + tasto menu, che apre lo stesso contenuto in
 * sovraimpressione. Sidebar resta montata (nascoste con `hidden md:flex`, v. AppShell): così lo stato di
 * compressione della barra laterale non si perde passando sopra/sotto la soglia md.
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

  // Le voci già raggiungibili dalla barra fissa in basso non vanno ripetute qui.
  const drawerItems = NAV_ITEMS.filter((item) => !BOTTOM_NAV_HREFS.includes(item.href));

  // Una navigazione riuscita chiude il menu. `skipFirstRun`: il primo giro dell'effetto, asincrono dopo il commit
  // iniziale, potrebbe arrivare DOPO un tocco sul tasto capitato nel frattempo (pagine lente al primo montaggio) e
  // richiudere il cassetto appena aperto --- saltarlo rimuove il rischio senza cambiare il resto del comportamento.
  const skipFirstRun = useRef(true);
  useEffect(() => {
    if (skipFirstRun.current) {
      skipFirstRun.current = false;
      return;
    }
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
      {/* Un <div>, non <header>: TopNav ha già il vero landmark "banner" della pagina, un secondo lo duplicherebbe. */}
      {/* sticky top-0: senza, il tasto ☰ scorreva via con la pagina, irraggiungibile su pagine lunghe. z-30, sotto i z-40/z-50 di barra in basso e finestre di sovraimpressione. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-side p-3 md:hidden dark:border-zinc-800">
        <Link href="/dashboard" className="shrink-0">
          <BrandLockup className="h-8 w-auto" darkSize="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Apri il menu"
          aria-expanded={open}
          className="shrink-0 rounded-full p-0.5 hover:ring-2 hover:ring-zinc-200 dark:hover:ring-zinc-800"
        >
          <Avatar firstName={firstName} lastName={lastName} avatarUrl={avatarUrl} seed={userId} size="sm" />
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
              "relative flex h-full w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-side p-4 shadow-xl transition-transform duration-300 ease-out",
              entered ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div className="flex items-center justify-between">
              <BrandLockup className="h-8 w-auto" darkSize="sm" />
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
              <PlanStatus />
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
