"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { NAV_ITEMS } from "@/components/layout/nav-items";

/**
 * `collapsed` --- v. Sidebar: nasconde le etichette (restano lette dagli
 * screen reader) e centra le sole icone. `horizontal` --- v. TopNav: solo
 * cambia la direzione (righe che vanno a capo invece di una colonna),
 * le etichette restano visibili accanto all'icona come nella barra
 * laterale espansa.
 */
export function MainNav({
  collapsed = false,
  horizontal = false,
}: {
  collapsed?: boolean;
  horizontal?: boolean;
}) {
  const pathname = usePathname();
  const { status } = useMasterKey();
  const iconOnly = collapsed;

  // Prima ancora di cliccarci sopra, un pallino segnala le voci che
  // presentano comunque il modulo "Configura la cifratura" --- altrimenti
  // lo si scopre solo cliccando, identico e senza preavviso su ognuna. Solo
  // per "not-set-up" (mai configurata): una volta configurata, "locked"
  // chiede solo di re-inserire la master password ad ogni sessione, un
  // attrito atteso che non ha bisogno dello stesso avviso. Il pallino è
  // solo descrittivo (aria-describedby su uno span a parte, mai dentro
  // l'etichetta): il nome accessibile del link resta "Archivio" e non
  // "Archivio (richiede...)", altrimenti ogni test/screen reader che cerca
  // il link per nome esatto smetterebbe di trovarlo appena prima di aver
  // configurato la cifratura.
  const needsSetup = status.kind === "not-set-up";

  return (
    <nav
      aria-label="Navigazione principale"
      className={horizontal ? "flex flex-wrap items-center gap-1" : "flex flex-col gap-1"}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname?.startsWith(`${item.href}/`);
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
                "flex items-center gap-2 rounded-xl py-2 text-sm font-medium transition-colors",
                iconOnly ? "justify-center px-2" : "px-3",
                isActive
                  ? "bg-brand/10 text-brand"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
              )}
            >
              <span className="relative" aria-hidden="true">
                {/* Sempre blu (colore del logo), a prescindere dallo stato
                    attivo/hover --- solo l'etichetta di testo segue lo
                    stato (v. className del Link qui sopra). */}
                <item.icon width={19} height={19} className="text-brand" />
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
