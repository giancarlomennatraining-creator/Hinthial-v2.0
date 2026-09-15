"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { createClient } from "@/lib/db/supabase/client";
import { getDeviceLockRecord } from "@/lib/device-lock-storage";
import {
  listTrustedDevices,
  forgetTrustedDevice,
  type TrustedDeviceListItem,
} from "@/domain/trusted-devices/repository";
import { logAuditEvent } from "@/lib/audit/log-event";
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * FASE 13, primo e ultimo passo insieme --- "rendere fidato" QUESTO
 * dispositivo (v. lib/crypto/device-lock.ts) più l'elenco di TUTTI i
 * dispositivi fidati dell'account, visibile e gestibile da qualunque
 * dispositivo tu stia guardando in questo momento, con la revoca da
 * remoto: se revochi un dispositivo diverso da questo, quello smette
 * di poter sbloccare al prossimo tentativo (v. MasterKeyProvider.tsx,
 * unlockWithDeviceLock/findActiveTrustedDevice) --- non c'è modo di
 * cancellarne subito la copia locale del Master Key da qui (vive nel
 * suo browser, irraggiungibile da altrove), ma da sola non basta più a
 * nulla una volta che il server non lo riconosce più come fidato.
 */
export function DeviceLockPanel({ userId }: { userId: string }) {
  const supabase = useRef(createClient()).current;
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

  const [devices, setDevices] = useState<TrustedDeviceListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setListError(null);
    try {
      setDevices(await listTrustedDevices(supabase, userId));
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Impossibile caricare i dispositivi fidati.");
    }
  }, [supabase, userId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshList();
  }, [refreshList]);

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
      await refreshList();
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

  async function handleForgetThisDevice() {
    setError(null);
    setBusy(true);
    try {
      await forgetDeviceLock();
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile dimenticare questo dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(device: TrustedDeviceListItem) {
    setListError(null);
    setRevokingId(device.id);
    try {
      const localRecord = getDeviceLockRecord(userId);
      if (localRecord?.deviceId === device.id) {
        // È questo stesso dispositivo --- passa dal metodo del
        // contesto, così svuota anche la copia locale (v.
        // MasterKeyProvider.tsx, forgetDeviceLock), non solo la riga
        // sul server.
        await forgetDeviceLock();
      } else {
        await forgetTrustedDevice(supabase, device.id);
        await logAuditEvent(supabase, userId, "trusted_device_revoked");
      }
      await refreshList();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Impossibile revocare il dispositivo.");
    } finally {
      setRevokingId(null);
    }
  }

  const thisDeviceId = getDeviceLockRecord(userId)?.deviceId ?? null;

  return (
    <div className="flex flex-col gap-8">
      {deviceLockSupported === null ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Verifica del dispositivo in corso…</p>
      ) : !deviceLockSupported ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Questo browser/dispositivo non supporta ancora lo sblocco biometrico locale --- resta
          comunque sempre disponibile la master password.
        </p>
      ) : deviceLockAvailable ? (
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
            onClick={handleForgetThisDevice}
            className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-red-950"
          >
            Dimentica questo dispositivo
          </button>
        </div>
      ) : (
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Confermando la tua master password, potrai in futuro sbloccare qui con l&apos;impronta
            o Face ID --- la password non lascia mai questo dispositivo.
          </p>

          <div className="flex flex-col gap-1">
            {/* "Nome del dispositivo fidato", non solo "Nome del dispositivo" ---
                l'MFA qui sopra (v. MfaSettingsPanel) ha già un campo identico per
                un dispositivo authenticator: due etichette uguali sulla stessa
                pagina, per due cose diverse, sarebbero ambigue. */}
            <label htmlFor="deviceLockLabel" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nome del dispositivo fidato
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
            Capisco che chi ha accesso fisico a questo dispositivo, sbloccato, potrà accedere al
            mio vault senza la master password.
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
      )}

      {/* Elenco di TUTTI i dispositivi fidati dell'account --- v. commento della funzione. */}
      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Tutti i dispositivi fidati
        </h3>

        {listError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {listError}
          </p>
        ) : null}

        {devices === null ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessun dispositivo fidato ancora.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {device.label}
                    {device.id === thisDeviceId ? (
                      <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                        questo dispositivo
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Registrato il {formatDate(device.createdAt)} --- ultimo accesso il{" "}
                    {formatDate(device.lastActiveAt)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={revokingId === device.id}
                  onClick={() => handleRevoke(device)}
                  className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {revokingId === device.id ? "Revoca…" : "Revoca"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
