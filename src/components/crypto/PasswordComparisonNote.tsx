/**
 * Il confronto a due righe tra password dell'account e master password
 * --- estratto qui perché usato in due punti (SetupMasterKeyForm e
 * MasterKeyIntroModal, il popup una tantum al primo accesso): stesso
 * identico testo, mai due copie che possono disallinearsi.
 */
export function PasswordComparisonNote() {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
      <p>
        <strong className="text-zinc-800 dark:text-zinc-200">Password account</strong> → per
        accedere al servizio.
      </p>
      <p>
        <strong className="text-zinc-800 dark:text-zinc-200">Master password</strong> → decifra i
        tuoi dati: è come la chiave di una cassaforte che tieni solo tu, nemmeno noi la vediamo.
      </p>
    </div>
  );
}
