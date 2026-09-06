"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  enrollTotpFactor,
  listVerifiedTotpFactors,
  totpQrCodeToImageSrc,
  unenrollTotpFactor,
  verifyTotpCode,
} from "@/domain/mfa/repository";
import type { MfaFactor, TotpEnrollment } from "@/domain/mfa/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Impostazioni -> Sicurezza: attiva/disattiva l'autenticazione a due
 * fattori (TOTP, v. domain/mfa/repository.ts) --- gestisce solo il
 * layer di identità (login), mai la master key/cifratura del vault:
 * i due restano completamente separati (v. HINTHIAL_MVP.md sezione 4).
 * Supporta più di un dispositivo registrato --- consigliato
 * esplicitamente, per non restare esclusi dall'account perdendo
 * l'unico dispositivo con l'app authenticator.
 */
export function MfaSettingsPanel() {
  const supabase = useRef(createClient()).current;

  const [factors, setFactors] = useState<MfaFactor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [deviceName, setDeviceName] = useState("Il mio telefono");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setFactors(await listVerifiedTotpFactors(supabase));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare lo stato dell'MFA.");
    }
  }, [supabase]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleStartEnroll() {
    if (!deviceName.trim()) {
      setError("Dai un nome a questo dispositivo, per riconoscerlo in futuro.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      setEnrollment(await enrollTotpFactor(supabase, deviceName.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile avviare l'attivazione.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelEnroll() {
    if (!enrollment) return;
    setBusy(true);
    try {
      await unenrollTotpFactor(supabase, enrollment.factorId);
    } catch {
      // Il fattore non confermato scade comunque da sé lato Supabase:
      // nessun blocco dell'interfaccia se la pulizia esplicita fallisce.
    } finally {
      setEnrollment(null);
      setCode("");
      setBusy(false);
    }
  }

  async function handleConfirmEnroll() {
    if (!enrollment) return;
    if (!code.trim()) {
      setError("Inserisci il codice a 6 cifre mostrato dall'app authenticator.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await verifyTotpCode(supabase, enrollment.factorId, code.trim());
      setEnrollment(null);
      setCode("");
      setDeviceName("Il mio telefono");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Codice non valido. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(factor: MfaFactor) {
    setError(null);
    setBusy(true);
    try {
      await unenrollTotpFactor(supabase, factor.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile rimuovere il dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !factors && !enrollment) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (!factors) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Autenticazione a due fattori
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Dopo email e password, un codice generato da un&apos;app come Google Authenticator o
          1Password. Riguarda solo l&apos;accesso al tuo account --- non la cifratura del vault,
          che resta protetta unicamente dalla tua master password.
        </p>
      </div>

      {enrollment ? (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Inquadra questo codice con l&apos;app authenticator, poi conferma con il codice a 6
            cifre che ti mostra.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI generato al volo, non un asset statico */}
          <img
            src={totpQrCodeToImageSrc(enrollment.qrCodeSvg)}
            alt="QR per l'app authenticator"
            className="h-48 w-48 self-center"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Non riesci a inquadrarlo? Inserisci questo codice a mano:{" "}
            <code className="break-all font-mono">{enrollment.secret}</code>
          </p>

          <div className="flex flex-col gap-1">
            <label htmlFor="mfaCode" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Codice a 6 cifre
            </label>
            <input
              id="mfaCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleConfirmEnroll}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {busy ? "Verifica…" : "Conferma"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleCancelEnroll}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <>
          {factors.length > 0 ? (
            <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {factors.map((factor) => (
                <li key={factor.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {factor.friendlyName}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Registrato il {formatDate(factor.createdAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRemove(factor)}
                    className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Rimuovi
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-full inline-block self-start bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-400">
              ⚠️ Non attiva
            </p>
          )}

          {factors.length > 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Ti consigliamo di registrare più di un dispositivo: se perdi l&apos;unico con l&apos;app
              authenticator, resti fuori dal tuo account.
            </p>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="deviceName" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Nome del dispositivo
              </label>
              <input
                id="deviceName"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="es. Il mio telefono"
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleStartEnroll}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {factors.length > 0 ? "+ Aggiungi un altro dispositivo" : "Attiva l'autenticazione a due fattori"}
            </button>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
