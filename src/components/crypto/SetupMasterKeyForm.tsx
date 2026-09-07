"use client";

import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { TextField } from "@/components/ui/TextField";
import { saveBlobAsFile } from "@/lib/download";
import { printOnlyMarkedContent } from "@/lib/print";
import type { MasterKeySetup } from "@/lib/crypto";

type PendingSetup = { setup: MasterKeySetup; masterKey: CryptoKey };

export function SetupMasterKeyForm() {
  const { setup, confirmSetup } = useMasterKey();
  const [pending, setPending] = useState<PendingSetup | null>(null);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Generato non appena la recovery key è pronta (non c'è bisogno di
  // aspettare un click: è quasi istantaneo) --- se fallisce, il kit
  // stampabile resta comunque completo, solo senza QR: la chiave in
  // chiaro nel testo basta da sola a recuperare l'accesso.
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    QRCode.toDataURL(pending.setup.recoveryKey.formatted, { margin: 1, width: 320 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // Nessun blocco del flusso di setup per questo dettaglio secondario.
      });
    return () => {
      cancelled = true;
    };
  }, [pending]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("masterPassword") ?? "");
    const confirmPassword = String(formData.get("confirmMasterPassword") ?? "");

    if (password.length < 8) {
      setError("La master password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }

    setBusy(true);
    try {
      const result = await setup(password);
      setPending(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Si è verificato un errore. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!pending) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(pending.setup.recoveryKey.formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Impossibile copiare negli appunti. Copiala manualmente.");
    }
  }

  function handleDownload() {
    if (!pending) return;
    setError(null);

    const text = [
      "HINTHIAL --- Recovery key",
      `Generata il ${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}`,
      "",
      pending.setup.recoveryKey.formatted,
      "",
      "Conservala in un posto sicuro (offline, non nella posta elettronica).",
      "Se dimentichi la master password, solo questa recovery key potrà farti",
      "recuperare i tuoi documenti. HINTHIAL non la conserva da nessuna parte.",
    ].join("\n");

    saveBlobAsFile(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
      "hinthial-recovery-key.txt",
    );
  }

  async function handleConfirm() {
    if (!pending) return;
    setError(null);
    setBusy(true);
    try {
      await confirmSetup(pending.setup, pending.masterKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Si è verificato un errore. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Salva la tua recovery key
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Se dimentichi la master password, solo questa recovery key potrà
            farti recuperare i tuoi documenti. HINTHIAL non la conserva da
            nessuna parte: viene mostrata una sola volta, adesso.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <code className="break-all rounded-md bg-zinc-100 p-4 text-center text-sm font-mono text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
            {pending.setup.recoveryKey.formatted}
          </code>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              ⬇️ Scarica come .txt
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {copied ? "✓ Copiata" : "📋 Copia negli appunti"}
            </button>
            <button
              type="button"
              onClick={printOnlyMarkedContent}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              🖨️ Stampa kit di recovery
            </button>
          </div>
        </div>

        {/*
          Fuori vista sullo schermo, mostrato solo nella finestra di
          stampa (v. lib/print.ts + la regola @media print in
          globals.css): un unico foglio pensato per essere conservato
          fisicamente, con la chiave anche come QR --- più comodo da
          reinserire su un dispositivo nuovo che ricopiarla a mano.
        */}
        <div className="print-only hidden flex-col items-center gap-6 p-12 text-center print:flex">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
          <img src="/brand/logo-lockup.svg" alt="HINTHIAL" className="h-12 w-auto" />
          <h1 className="text-2xl font-semibold text-zinc-950">Kit di recovery</h1>
          <p className="max-w-md text-sm text-zinc-700">
            Se dimentichi la tua master password, questa è l&apos;unica chiave che potrà farti
            recuperare l&apos;accesso ai tuoi documenti. HINTHIAL non la conserva da nessuna parte:
            conservala tu, offline, in un posto sicuro (es. una cassaforte) --- non nella posta
            elettronica.
          </p>
          <code className="break-all rounded-md border border-zinc-300 p-4 text-base font-mono text-zinc-950">
            {pending.setup.recoveryKey.formatted}
          </code>
          {qrDataUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL generato al volo, non un asset statico */}
              <img src={qrDataUrl} alt="QR della recovery key" className="h-40 w-40" />
              <p className="text-xs text-zinc-500">
                Inquadra questo codice con la fotocamera per recuperare la chiave senza doverla
                ricopiare a mano su un dispositivo nuovo.
              </p>
            </>
          ) : null}
          <p className="text-xs text-zinc-400">
            Generato il{" "}
            {new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmedSaved}
            onChange={(e) => setConfirmedSaved(e.target.checked)}
          />
          Ho salvato la recovery key in un posto sicuro.
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!confirmedSaved || busy}
          onClick={handleConfirm}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {busy ? "Attendere…" : "Continua"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          Configura la cifratura
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Crea una master password per proteggere i tuoi documenti. È
          diversa dalla password del tuo account e non lascia mai questo
          dispositivo.
        </p>
      </div>

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

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Ci vuole un minuto: crei una password, salvi una chiave di recupero, poi sei dentro.
      </p>

      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <TextField
          id="masterPassword"
          name="masterPassword"
          label="Master password"
          type="password"
          autoComplete="new-password"
          required
        />
        <TextField
          id="confirmMasterPassword"
          name="confirmMasterPassword"
          label="Conferma master password"
          type="password"
          autoComplete="new-password"
          required
        />

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {busy ? "Configurazione…" : "Crea"}
        </button>
      </form>
    </div>
  );
}
