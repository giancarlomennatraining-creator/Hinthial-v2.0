"use client";

import { useState, type FormEvent } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { TextField } from "@/components/ui/TextField";

/** Solo un suggerimento amichevole, mai affidabile al 100% --- l'utente può sempre correggerlo. */
function guessDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Questo dispositivo";
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : "questo dispositivo";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return browser ? `${browser} su ${os}` : os;
}

/**
 * FASE 13, primo passo --- "rendere fidato" QUESTO dispositivo, così può
 * sbloccare il vault con l'impronta/Face ID invece della master
 * password (v. lib/crypto/device-lock.ts). Solo lo stato di questo
 * singolo dispositivo: l'elenco di TUTTI i dispositivi fidati
 * dell'account (per rivederli/revocarli anche da un altro) arriva con
 * una fase successiva --- qui l'unica azione disponibile su un
 * dispositivo diverso da questo è, implicitamente, nessuna.
 */
export function DeviceLockPanel() {
  const {
    deviceLockSupported,
    deviceLockAvailable,
    registerDeviceLock,
    forgetDeviceLock,
  } = useMasterKey();

  const [label, setLabel] = useState(guessDeviceLabel);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("masterPassword") ?? "");
    if (!label.trim()) {
      setError("Dai un nome a questo dispositivo, per riconoscerlo in futuro.");
      return;
    }

    setBusy(true);
    try {
      await registerDeviceLock(password, label.trim());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("Decryption")
            ? "Master password non corretta."
            : err.message
          : "Impossibile registrare questo dispositivo. Riprova.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleForget() {
    setError(null);
    setBusy(true);
    try {
      await forgetDeviceLock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile dimenticare questo dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  if (deviceLockSupported === null) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Verifica del dispositivo in corso…</p>;
  }

  if (!deviceLockSupported) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Questo browser/dispositivo non supporta ancora lo sblocco biometrico locale --- resta
        comunque sempre disponibile la master password.
      </p>
    );
  }

  if (deviceLockAvailable) {
    return (
      <div className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-1 self-start rounded-full bg-lime-100 px-2.5 py-1 text-xs font-medium text-lime-700 dark:bg-lime-950 dark:text-lime-400">
          ✓ Questo dispositivo è fidato
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Puoi sbloccare qui con l&apos;impronta o Face ID, senza digitare la master password.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={handleForget}
          className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-red-950"
        >
          Dimentica questo dispositivo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleRegister} className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Confermando la tua master password, potrai in futuro sbloccare qui con l&apos;impronta o
        Face ID --- la password non lascia mai questo dispositivo.
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="deviceLockLabel" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Nome del dispositivo
        </label>
        <input
          id="deviceLockLabel"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="es. Il mio telefono"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>

      <TextField
        id="deviceLockPassword"
        name="masterPassword"
        label="Master password"
        type="password"
        autoComplete="current-password"
        required
      />

      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Capisco che chi ha accesso fisico a questo dispositivo, sbloccato, potrà accedere al mio
        vault senza la master password.
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !confirmed}
        className="self-start rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? "Registrazione…" : "Rendi fidato questo dispositivo"}
      </button>
    </form>
  );
}
