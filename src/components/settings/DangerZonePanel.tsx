import { ResetAccountCard } from "@/components/settings/ResetAccountCard";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";

/**
 * Impostazioni -> Zona pericolosa: due operazioni distinte, entrambe
 * irreversibili e dietro reinserimento della master password ---
 * "Reimposta l'account" (svuota il vault, l'account resta attivo) e
 * "Cancella il tuo account" (cancella anche l'account stesso). V. i due
 * componenti per i dettagli di ciascuna.
 */
export function DangerZonePanel({ userId, masterKey }: { userId: string; masterKey: CryptoKey }) {
  return (
    <div className="flex flex-col gap-6">
      <ResetAccountCard userId={userId} masterKey={masterKey} />
      <DeleteAccountCard />
    </div>
  );
}
