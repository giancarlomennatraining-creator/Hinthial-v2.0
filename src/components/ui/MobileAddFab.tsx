import Link from "next/link";

/**
 * Sotto `sm`, sostituisce il tasto "+ Aggiungi/Crea" dell'intestazione con un "+" tondo fisso sopra BottomNavBar,
 * stessa pagina di creazione. I chiamanti riservano un padding-bottom aggiuntivo (`pb-[calc(3rem+...)] sm:pb-0`)
 * così l'ultima riga di lista non finisce sotto al FAB, intercettando il suo tasto "⋮" (v. RowActionsMenu).
 * "Aggiuntivo" perché `<main>` riserva già 6rem sotto `md` per BottomNavBar: il padding qui copre solo la differenza
 * fino agli 8.5rem reali del FAB, non l'intero spazio da zero (altrimenti le due riserve si sommerebbero).
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
