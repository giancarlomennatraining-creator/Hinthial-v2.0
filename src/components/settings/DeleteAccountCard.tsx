"use client";

import { useRouter } from "next/navigation";
import { DangerConfirmCard } from "@/components/settings/DangerConfirmCard";
import { deleteAccount } from "@/lib/account/actions";

/**
 * Cancellazione definitiva dell'account: a differenza di ResetAccountCard, qui sparisce anche l'account stesso
 * (v. lib/account/actions.ts per cosa viene eliminato, tutto in cascata da auth.users). Non serve la Master Key
 * stessa: Storage viene ripulito per prefisso lato server.
 */
export function DeleteAccountCard() {
  const router = useRouter();

  return (
    <DangerConfirmCard
      title="Cancella il tuo account"
      description={
        <>
          Cancella per sempre il tuo account Hinthial e ogni dato ad esso collegato: non potrai più accedere con
          queste credenziali. A differenza di &quot;Reimposta l&apos;account&quot;, qui sparisce anche
          l&apos;account stesso, non solo il suo contenuto. Richiede la tua master password. L&apos;operazione non è
          reversibile, e riceverai un&apos;email di conferma.
        </>
      }
      triggerLabel="Cancella account"
      dialogLabel="Conferma cancellazione account"
      dialogText="Il tuo account e tutti i dati collegati verranno cancellati per sempre. Non si può annullare."
      confirmPhrase="CANCELLA ACCOUNT"
      idPrefix="delete"
      confirmLabel="Cancella definitivamente"
      busyLabel="Cancellazione…"
      fallbackError="Impossibile completare la cancellazione."
      run={async () => {
        await deleteAccount();
        router.push("/");
      }}
    />
  );
}
