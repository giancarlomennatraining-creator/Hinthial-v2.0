"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  countBackupCodes,
  enrollTotpFactor,
  listVerifiedTotpFactors,
  regenerateBackupCodes,
  totpQrCodeToImageSrc,
  unenrollFactor,
  verifyTotpCode,
} from "@/domain/mfa/repository";
import { saveBlobAsFile } from "@/lib/download";
import { logAuditEvent } from "@/lib/audit/log-event";
import type { MfaFactor, TotpEnrollment } from "@/domain/mfa/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

function FactorList({
  factors,
  busy,
  onRemove,
}: {
  factors: MfaFactor[];
  busy: boolean;
  onRemove: (factor: MfaFactor) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {factors.map((factor) => (
        <li key={factor.id} className="flex items-center justify-between gap-4 p-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{factor.friendlyName}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Registrato il {formatDate(factor.createdAt)}
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRemove(factor)}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950"
          >
            Rimuovi
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Impostazioni -> Sicurezza: gestisce solo il layer di identità
 * (login), mai la master key/cifratura del vault --- i due restano
 * completamente separati (v. HINTHIAL_MVP.md sezione 4). Due pezzi:
 * TOTP (Google Authenticator/1Password) e codici di backup monouso per
 * chi perde l'accesso al proprio dispositivo. Supporta più di un
 * dispositivo TOTP --- consigliato registrarne più di uno.
 *
 * Una passkey (WebAuthn) come fattore alternativo è stata valutata ed
 * esplorata (v. CHANGELOG.md), ma non implementata: il progetto
 * Supabase usato oggi non espone un modo per attivarla per questo
 * scopo, solo per il login primario (funzionalità diversa) --- da
 * rivalutare quando la situazione lato Supabase sarà più chiara.
 */
export function MfaSettingsPanel({ userId }: { userId: string }) {
  const supabase = useRef(createClient()).current;

  const [factors, setFactors] = useState<MfaFactor[] | null>(null);
  const [backupCodesCount, setBackupCodesCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [deviceName, setDeviceName] = useState("Il mio telefono");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");

  const [revealedCodes, setRevealedCodes] = useState<string[] | null>(null);
  const [confirmedSavedCodes, setConfirmedSavedCodes] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [totp, codesCount] = await Promise.all([
        listVerifiedTotpFactors(supabase),
        countBackupCodes(supabase, userId),
      ]);
      setFactors(totp);
      setBackupCodesCount(codesCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare lo stato dell'MFA.");
    }
  }, [supabase, userId]);

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
      await unenrollFactor(supabase, enrollment.factorId);
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
      await logAuditEvent(supabase, userId, "mfa_enrolled");
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

  async function handleRemoveFactor(factor: MfaFactor) {
    setError(null);
    setBusy(true);
    try {
      await unenrollFactor(supabase, factor.id);
      await logAuditEvent(supabase, userId, "mfa_removed");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile rimuovere il dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateBackupCodes() {
    setError(null);
    setBusy(true);
    try {
      setConfirmedSavedCodes(false);
      const codes = await regenerateBackupCodes(supabase, userId);
      await logAuditEvent(supabase, userId, "backup_codes_generated");
      setRevealedCodes(codes);
      setBackupCodesCount(codes.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile generare i codici di backup.");
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadBackupCodes() {
    if (!revealedCodes) return;
    const text = [
      "HINTHIAL --- Codici di backup per l'autenticazione a due fattori",
      `Generati il ${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}`,
      "",
      ...revealedCodes,
      "",
      "Ognuno è utilizzabile una sola volta, al posto del codice dell'app authenticator,",
      "se perdi l'accesso al tuo dispositivo. Conservali in un posto sicuro.",
    ].join("\n");
    saveBlobAsFile(new Blob([text], { type: "text/plain;charset=utf-8" }), "hinthial-codici-backup.txt");
  }

  function handleDismissRevealedCodes() {
    setRevealedCodes(null);
    setConfirmedSavedCodes(false);
  }

  if (error && !factors && !enrollment) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (!factors || backupCodesCount === null) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-10">
      {/* --- TOTP (app authenticator) --- */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            App authenticator
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
              src={totpQrCodeToImageSrc(enrollment.qrCode)}
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
              <FactorList factors={factors} busy={busy} onRemove={handleRemoveFactor} />
            ) : (
              <p className="inline-block self-start rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                ⚠️ Non attiva
              </p>
            )}

            {factors.length > 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ti consigliamo di registrare più di un dispositivo: se perdi l&apos;unico con
                l&apos;app authenticator, resti fuori dal tuo account.
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

      {/* --- Codici di backup --- */}
      {factors.length > 0 ? (
        <div className="flex flex-col gap-4 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Codici di backup
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Da usare al posto di un codice se perdi l&apos;accesso al tuo dispositivo. Ognuno
              funziona una sola volta.
            </p>
          </div>

          {revealedCodes ? (
            <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Salvane una copia adesso: non verranno mostrati di nuovo.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {revealedCodes.map((backupCode) => (
                  <code
                    key={backupCode}
                    className="rounded-md bg-zinc-100 p-2 text-center font-mono text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {backupCode}
                  </code>
                ))}
              </div>
              <button
                type="button"
                onClick={handleDownloadBackupCodes}
                className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                ⬇️ Scarica come .txt
              </button>

              <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmedSavedCodes}
                  onChange={(e) => setConfirmedSavedCodes(e.target.checked)}
                />
                Ho salvato questi codici in un posto sicuro.
              </label>

              <button
                type="button"
                disabled={!confirmedSavedCodes}
                onClick={handleDismissRevealedCodes}
                className="self-start rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                Fatto
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {backupCodesCount > 0
                  ? `${backupCodesCount} codici rimasti.`
                  : "Nessun codice di backup generato."}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={handleGenerateBackupCodes}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {backupCodesCount > 0 ? "Rigenera codici di backup" : "Genera codici di backup"}
              </button>
            </div>
          )}

          {backupCodesCount > 0 && !revealedCodes ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Rigenerarli invalida subito tutti i codici precedenti.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
