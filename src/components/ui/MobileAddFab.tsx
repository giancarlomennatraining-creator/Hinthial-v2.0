import Link from "next/link";

/**
 * Su smartphone (sotto la soglia `sm`), il tasto "+ Aggiungi/Crea"
 * dell'intestazione di pagina (v. AssetsPanel, CapsulesPanel,
 * FriendsPanel, DocumentsPanel, RemindersPanel) lascia il
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
 * padding-bottom aggiuntivo sul proprio contenitore esterno ---
 * `pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0` --- così
 * l'ultima riga si ferma sempre sopra il FAB, mai sotto.
 *
 * "Aggiuntivo" perché `<main>` (v. AppShell) riserva già `pb-24` (6rem)
 * sotto `md` per non far finire i contenuti sotto la barra di
 * navigazione fissa (v. BottomNavBar): il FAB, alto 3.5rem (`h-14`) e
 * scostato da `bottom-[calc(5rem+...)]`, arriva a 8.5rem dal fondo
 * reale dello schermo --- 2.5rem oltre ai 6rem già riservati da
 * `<main>`. Il padding qui copre solo quella differenza, più un
 * margine di mezzo rem: contarli entrambi da zero (come nella prima
 * versione di questo fix, 9.5rem pieni) sommava le due riserve invece
 * di sottrarle, lasciando in fondo alla lista un vuoto ben più grande
 * del necessario.
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
