"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { isNavItemActive, NAV_ITEMS, type NavItem } from "@/components/layout/nav-items";

/** `collapsed` (v. Sidebar): nasconde le etichette (lette dagli screen reader) e centra le icone. */
export function MainNav({
  collapsed = false,
  items = NAV_ITEMS,
}: {
  collapsed?: boolean;
  /** Sottoinsieme di NAV_ITEMS da mostrare, usato dal cassetto mobile per escludere le voci già nella barra fissa in basso. */
  items?: NavItem[];
}) {
  const pathname = usePathname();
  const { status } = useMasterKey();
  const iconOnly = collapsed;

  // Un pallino segnala le voci che presentano il modulo "Configura la cifratura", solo per "not-set-up" (mai
  // configurata): "locked" chiede solo di re-inserire la password, un attrito atteso senza bisogno dell'avviso.
  // Il pallino è solo descrittivo (aria-describedby a parte): il nome accessibile del link resta "Archivio".
  const needsSetup = status.kind === "not-set-up";

  return (
    <nav
      aria-label="Navigazione principale"
      className="flex flex-col gap-1"
    >
      {items.map((item) => {
        const isActive = isNavItemActive(item, pathname);
        const showSetupHint = needsSetup && item.requiresEncryption;
        const hintId = `nav-setup-hint-${item.href}`;
        return (
          <span key={item.href} className="contents">
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              aria-describedby={showSetupHint ? hintId : undefined}
              title={
                iconOnly
                  ? showSetupHint
                    ? `${item.label} (richiede di configurare la cifratura)`
                    : item.label
                  : undefined
              }
              className={cn(
                "flex items-center gap-2 rounded-full py-2 text-sm font-medium transition-colors",
                iconOnly ? "justify-center px-2" : "px-3",
                isActive
                  ? "bg-brand/10 text-accent"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
              )}
            >
              <span className="relative" aria-hidden="true">
                {/* Sempre blu a prescindere dallo stato attivo/hover: solo l'etichetta di testo lo segue. */}
                <item.icon width={19} height={19} className="text-accent" />
                {showSetupHint ? (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-orange-500" />
                ) : null}
              </span>
              <span className={iconOnly ? "sr-only" : undefined}>{item.label}</span>
            </Link>
            {showSetupHint ? (
              <span id={hintId} className="sr-only">
                Richiede di configurare la cifratura.
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}
