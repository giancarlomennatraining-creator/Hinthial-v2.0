import Link from "next/link";

/**
 * Su smartphone (sotto la soglia `sm`), il tasto "+ Aggiungi/Crea"
 * dell'intestazione di pagina (v. AssetsPanel, CapsulesPanel,
 * TrustedContactsPanel, DocumentsPanel, RemindersPanel) lascia il
 * posto a questo "+" tondo in sovraimpressione, fisso sopra la barra
 * di navigazione rapida (v. BottomNavBar) --- porta alla stessa
 * pagina di creazione di sempre. Da `sm` in su resta il tasto normale
 * nell'intestazione, questo pulsante scompare.
 *
 * Occupa sempre lo stesso rettangolo fisso in basso a destra --- se la
 * lista sotto scorresse fino a incollare l'ultima riga al fondo dello
 * schermo, il tasto "⋮" delle sue azioni finirebbe proprio lì sotto,
 * intercettato dal FAB invece che dalla riga (v. RowActionsMenu). Per
 * questo ognuno dei cinque componenti sopra riserva, sotto `sm`, un
 * padding-bottom pari all'ingombro del FAB (bottom-offset + altezza)
 * più un margine --- `pb-[calc(9.5rem+env(safe-area-inset-bottom))]
 * sm:pb-0` sul contenitore esterno --- così l'ultima riga si ferma
 * sempre sopra il FAB, mai sotto.
 */
export function MobileAddFab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-3xl leading-none font-light text-white shadow-lg hover:bg-brand-hover sm:hidden"
    >
      +
    </Link>
  );
}
