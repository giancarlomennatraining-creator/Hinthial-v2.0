import Link from "next/link";

/**
 * Su smartphone (sotto la soglia `sm`), il tasto "+ Aggiungi/Crea"
 * dell'intestazione di pagina (v. AssetsPanel, CapsulesPanel,
 * TrustedContactsPanel, DocumentsPanel, RemindersPanel) lascia il
 * posto a questo "+" tondo in sovraimpressione, fisso sopra la barra
 * di navigazione rapida (v. BottomNavBar) --- porta alla stessa
 * pagina di creazione di sempre. Da `sm` in su resta il tasto normale
 * nell'intestazione, questo pulsante scompare.
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
