"use client";

import { useState } from "react";
import { downloadZip } from "client-zip";
import { createClient } from "@/lib/db/supabase/client";
import { buildExport } from "@/domain/export/repository";
import { saveBlobAsFile } from "@/lib/download";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * FASE 9 --- Export e recovery: un unico archivio .zip con tutto quello
 * che HINTHIAL sa dell'utente --- profilo, categorie, asset, documenti
 * (file compresi), scadenze, contatti fiduciari e capsule (allegati
 * compresi) --- decifrato interamente lato client con la Master Key già
 * sbloccata (passata dalla pagina). Il server non vede mai il contenuto
 * in chiaro, nemmeno durante l'export: legge solo lo stesso ciphertext
 * che ogni altra schermata già legge.
 *
 * "Recovery workflow" e "verifica recovery key" (le altre due voci della
 * FASE 9) esistono già dalla FASE 3: la recovery key si genera e si
 * conferma in fase di creazione della Master Key, e sblocca l'accesso da
 * UnlockMasterKeyForm se la master password viene dimenticata.
 */
export function ExportPanel({
  masterKey,
  firstName,
  lastName,
  email,
}: {
  masterKey: CryptoKey;
  firstName: string;
  lastName: string;
  email: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ fileCount: number; totalSize: number } | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessione scaduta. Ricarica la pagina e riprova.");

      const { files } = await buildExport(supabase, masterKey, user.id, {
        firstName,
        lastName,
        email,
      });

      const zipResponse = downloadZip(files.map((f) => ({ name: f.path, input: f.data })));
      const blob = await zipResponse.blob();

      const today = new Date().toISOString().slice(0, 10);
      saveBlobAsFile(blob, `hinthial-export-${today}.zip`);

      setDone({
        fileCount: files.length,
        totalSize: files.reduce((sum, f) => sum + f.data.byteLength, 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile completare l'export. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Esporta i tuoi dati</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Genera un archivio .zip con tutto quello che HINTHIAL conserva per il tuo account: profilo e
          categorie, asset, documenti (i file originali inclusi), scadenze, contatti fiduciari e
          capsule (allegati inclusi), più un file <code>manifest.json</code> con tutti i dettagli in
          chiaro. Tutto viene decifrato qui, nel tuo browser, con la tua Master Key: il server non vede
          mai il contenuto in chiaro, nemmeno durante l&apos;export.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {done ? (
        <p className="text-sm text-lime-700 dark:text-lime-400">
          Archivio scaricato: {done.fileCount} file, {formatSize(done.totalSize)} in totale.
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="w-fit rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? "Preparazione dell'archivio…" : "⬇️ Scarica tutti i dati (.zip)"}
      </button>
    </div>
  );
}
