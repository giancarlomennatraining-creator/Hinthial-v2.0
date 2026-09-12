import { CheckCircleIcon } from "@/components/icons/nav-icons";

/**
 * Il messaggio "✅ X creato/aggiornato." dopo un salvataggio riuscito ---
 * identico (stesso colore, stessa forma) in ogni pannello con un form di
 * creazione/modifica (v. AssetsPanel, CapsulesPanel, FriendsPanel,
 * DocumentsPanel, RemindersPanel): estratto qui per avere l'icona a linea
 * (v. icons/nav-icons.tsx) in un solo punto invece che ricopiata ovunque.
 */
export function SuccessMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-lime-700 dark:text-lime-400">
      <CheckCircleIcon width={16} height={16} className="shrink-0" />
      {children}
    </p>
  );
}
