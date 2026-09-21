"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { TextField } from "@/components/ui/TextField";
import { SecurityIcon, KeyIcon } from "@/components/icons/nav-icons";
import { saveBlobAsFile } from "@/lib/download";
import { printOnlyMarkedContent } from "@/lib/print";
import type { MasterKeySetup } from "@/lib/crypto";

type PendingSetup = { setup: MasterKeySetup; masterKey: CryptoKey };

/**
 * "Passo X di 2" --- lo stesso idioma già usato per la creazione di una
 * capsula (wizard a due passi), qui applicato alla creazione del vault:
 * crea la password, salva la recovery key.
 */
function StepStepper({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
      Passo {step} di 2
      <span className="flex gap-1">
        <span
          className={`h-1 w-3.5 rounded-full ${step === 1 ? "bg-brand" : "bg-zinc-200 dark:bg-zinc-800"}`}
        />
        <span
          className={`h-1 w-3.5 rounded-full ${step === 2 ? "bg-brand" : "bg-zinc-200 dark:bg-zinc-800"}`}
        />
      </span>
    </div>
  );
}

/** Il medaglione con l'icona --- stesso linguaggio di UnlockMasterKeyForm, un'icona diversa per passo (lucchetto mentre proteggi, chiave mentre conservi la via d'emergenza). */
function Medallion({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center self-center rounded-full bg-[radial-gradient(circle,rgba(43,79,196,0.14),transparent_72%)]">
      {children}
    </div>
  );
}

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
    // Import dinamico apposta: "qrcode" serve solo in questo istante,
    // una volta sola per account (la primissima configurazione della
    // cifratura) --- caricarla staticamente in cima al file la
    // spedirebbe invece con ogni pagina protetta da RequireMasterKey,
    // dato che quel gate importa questo form anche per chi ha già
    // configurato la cifratura da tempo e non lo vedrà mai renderizzato.
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(pending.setup.recoveryKey.formatted, { margin: 1, width: 320 }),
      )
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
      <div className="mx-auto mt-6 flex max-w-md flex-col gap-3">
        <StepStepper step={2} />
        <div className="flex flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-8 shadow-[0_1px_2px_rgba(23,31,60,0.05),0_20px_44px_-22px_rgba(23,31,60,0.22)] dark:border-zinc-800 dark:bg-zinc-950">
          <Medallion>
            <KeyIcon width={26} height={26} className="text-brand" />
          </Medallion>

          <div className="flex flex-col gap-1 text-center">
            <h1 className="text-lg font-semibold text-brand">Salva la tua recovery key</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Se dimentichi la master password, solo questa recovery key potrà farti recuperare
              i tuoi documenti. HINTHIAL non la conserva da nessuna parte: viene mostrata una
              sola volta, adesso.
            </p>
          </div>

          <code className="break-all rounded-2xl bg-zinc-100 p-4 text-center text-sm font-mono text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
            {pending.setup.recoveryKey.formatted}
          </code>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-full border border-zinc-300 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              ⬇️ Scarica .txt
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-zinc-300 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {copied ? "✓ Copiata" : "📋 Copia negli appunti"}
            </button>
            <button
              type="button"
              onClick={printOnlyMarkedContent}
              className="rounded-full border border-zinc-300 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              🖨️ Stampa kit di recovery
            </button>
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
              recuperare l&apos;accesso ai tuoi documenti. HINTHIAL non la conserva da nessuna
              parte: conservala tu, offline, in un posto sicuro (es. una cassaforte) --- non
              nella posta elettronica.
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

          <label className="flex items-start gap-2.5 rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <input
              type="checkbox"
              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-brand"
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
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {busy ? "Attendere…" : "Continua"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 flex max-w-sm flex-col gap-3">
      <StepStepper step={1} />
      <div className="flex flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-8 shadow-[0_1px_2px_rgba(23,31,60,0.05),0_20px_44px_-22px_rgba(23,31,60,0.22)] dark:border-zinc-800 dark:bg-zinc-950">
        <Medallion>
          <SecurityIcon width={26} height={26} className="text-brand" />
        </Medallion>

        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-lg font-semibold text-brand">Configura la cifratura</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Crea una master password per proteggere i tuoi documenti. È diversa dalla password
            del tuo account e non lascia mai questo dispositivo.
          </p>
        </div>

        {/*
          Stessa nota di sempre (v. PasswordComparisonNote, condivisa
          anche con MasterKeyIntroModal), qui riscritta in locale con un
          punto colorato sulla riga che conta davvero --- restilizzare
          il componente condiviso avrebbe cambiato anche quel popup, non
          richiesto da questo restyle.
        */}
        <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span>
              <strong className="text-zinc-800 dark:text-zinc-200">Password account</strong> →
              per accedere al servizio.
            </span>
          </div>
          <div className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
            <span>
              <strong className="text-zinc-800 dark:text-zinc-200">Master password</strong> →
              decifra i tuoi dati: è come la chiave di una cassaforte che tieni solo tu, nemmeno
              noi la vediamo.
            </span>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          Ci vuole un minuto: crei una password, salvi una chiave di recupero, poi sei dentro.
        </p>

        <form onSubmit={handleCreate} className="flex flex-col gap-4 text-left">
          <TextField
            id="masterPassword"
            name="masterPassword"
            label="Master password"
            type="password"
            autoComplete="new-password"
            variant="halo"
            required
          />
          <TextField
            id="confirmMasterPassword"
            name="confirmMasterPassword"
            label="Conferma master password"
            type="password"
            autoComplete="new-password"
            variant="halo"
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
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {busy ? "Configurazione…" : "Crea"}
          </button>
        </form>
      </div>
    </div>
  );
}
