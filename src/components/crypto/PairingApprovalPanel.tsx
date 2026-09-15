"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  approvePairingRequest,
  getPairingRequest,
  type PairingRequest,
} from "@/domain/device-pairing/repository";
import {
  unlockMasterKeyWithPassword,
  deriveSharedKeyAsSender,
  wrapKey,
  serializeEnvelope,
  parsePbkdf2Params,
  parseEnvelope,
} from "@/lib/crypto";
import { TextField } from "@/components/ui/TextField";

/**
 * FASE 13, secondo passo --- lato dispositivo già fidato (lo smartphone,
 * dopo aver scansionato il QR mostrato dal PC): questa pagina cifra il
 * Master Key apposta per QUEL dispositivo nuovo, senza che il server
 * veda mai né l'uno né l'altro in chiaro (v.
 * domain/device-pairing/repository.ts).
 *
 * Richiede di nuovo la master password, anche se il vault è già
 * sbloccato in questa sessione --- stessa scelta di DeviceLockPanel
 * (v. MasterKeyProvider.tsx, registerDeviceLock): è l'unico modo di
 * ottenere una copia esportabile del Master Key, mai altrimenti
 * concessa.
 */
export function PairingApprovalPanel({ requestId }: { requestId: string }) {
  const [request, setRequest] = useState<PairingRequest | null | "loading">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      try {
        const found = await getPairingRequest(supabase, requestId);
        if (!cancelled) setRequest(found);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossibile leggere la richiesta.");
          setRequest(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  async function handleApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request === "loading" || !request) return;
    setError(null);
    setBusy(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("masterPassword") ?? "");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const { data, error: fetchError } = await supabase
        .from("encryption_setup")
        .select("master_key_wrapped_by_password, pbkdf2_params")
        .eq("owner_id", user.id)
        .single();
      if (fetchError || !data) {
        throw new Error("Configurazione di cifratura non trovata.");
      }

      const extractableMasterKey = await unlockMasterKeyWithPassword(
        password,
        parsePbkdf2Params(data.pbkdf2_params),
        parseEnvelope(data.master_key_wrapped_by_password),
        true,
      );

      const { sharedKey, ephemeralPublicKeyJwk } = await deriveSharedKeyAsSender(
        request.newDevicePublicKey,
      );
      const encryptedMasterKey = await wrapKey(sharedKey, extractableMasterKey);

      await approvePairingRequest(
        supabase,
        requestId,
        ephemeralPublicKeyJwk,
        serializeEnvelope(encryptedMasterKey),
      );
      setApproved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("Decryption")
            ? "Master password non corretta."
            : err.message
          : "Impossibile autorizzare l'accesso. Riprova.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (request === "loading") {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  if (!request) {
    return (
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="text-xl font-semibold text-brand">Richiesta non trovata</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Questo codice non esiste più, o è scaduto (dura solo pochi minuti) --- torna al
          dispositivo che vuoi sbloccare e genera un nuovo codice.
        </p>
      </div>
    );
  }

  if (approved) {
    return (
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="text-xl font-semibold text-brand">✓ Accesso autorizzato</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          L&apos;altro dispositivo si sbloccherà da solo entro pochi secondi. Puoi chiudere questa
          pagina.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleApprove} className="flex max-w-sm flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-brand">Autorizzare l&apos;accesso?</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Un altro dispositivo sta chiedendo di sbloccare il tuo vault. Confermando con la master
          password, gli darai accesso --- senza che debba digitarla lui stesso.
        </p>
      </div>

      <TextField
        id="pairingApprovalPassword"
        name="masterPassword"
        label="Master password"
        type="password"
        autoComplete="current-password"
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
        className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? "Autorizzazione…" : "Autorizza"}
      </button>
    </form>
  );
}
