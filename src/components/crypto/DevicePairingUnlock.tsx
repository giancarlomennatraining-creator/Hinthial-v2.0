"use client";

import { useEffect, useRef, useState } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";

const POLL_INTERVAL_MS = 2000;
/** Deve restare in linea con "interval '5 minutes'" nella migrazione (v. device_pairing_requests). */
const EXPIRY_MS = 5 * 60 * 1000;

type PanelState = "closed" | "loading" | "waiting" | "expired" | "error";

/**
 * FASE 13, terzo passo --- lato dispositivo nuovo (non ancora fidato):
 * mostra un QR code che un dispositivo già fidato (lo smartphone) può
 * scansionare per sbloccare qui il vault, senza mai digitare la master
 * password su QUESTO dispositivo (v. MasterKeyProvider.tsx,
 * startDevicePairing/tryCompleteDevicePairing --- entrambi
 * documentano perché il server non vede mai né il Master Key né una
 * chiave capace di derivarlo).
 */
export function DevicePairingUnlock() {
  const { startDevicePairing, tryCompleteDevicePairing, cancelDevicePairing } = useMasterKey();
  const [panelState, setPanelState] = useState<PanelState>("closed");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pairingRef = useRef<{ requestId: string; privateKey: CryptoKey; startedAt: number } | null>(
    null,
  );

  async function handleOpen() {
    setPanelState("loading");
    setError(null);
    try {
      const { requestId, pairingUrl, privateKey } = await startDevicePairing();
      pairingRef.current = { requestId, privateKey, startedAt: Date.now() };

      // Import dinamico apposta --- v. SetupMasterKeyForm.tsx per lo
      // stesso motivo: "qrcode" serve solo in questo istante, non deve
      // finire nel bundle di ogni pagina protetta.
      const { default: QRCode } = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(pairingUrl, { margin: 1, width: 280 });
      setQrDataUrl(dataUrl);
      setPanelState("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile generare il codice. Riprova.");
      setPanelState("error");
    }
  }

  function handleClose() {
    if (pairingRef.current) void cancelDevicePairing(pairingRef.current.requestId);
    pairingRef.current = null;
    setQrDataUrl(null);
    setPanelState("closed");
    setError(null);
  }

  useEffect(() => {
    if (panelState !== "waiting") return;
    const pairing = pairingRef.current;
    if (!pairing) return;

    const interval = setInterval(async () => {
      if (Date.now() - pairing.startedAt > EXPIRY_MS) {
        clearInterval(interval);
        setPanelState("expired");
        return;
      }
      try {
        // Se true, il contesto è già passato a "unlocked" --- questo
        // pannello smette semplicemente di interessare (v.
        // UnlockMasterKeyForm, che smonta tutto non appena lo stato
        // cambia).
        await tryCompleteDevicePairing(pairing.requestId, pairing.privateKey);
      } catch {
        // Riprova al giro successivo --- un errore isolato (rete...)
        // non deve far sparire il QR ancora valido.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [panelState, tryCompleteDevicePairing]);

  if (panelState === "closed") {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        Sblocca con un dispositivo fidato
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {panelState === "loading" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Generazione del codice…</p>
      ) : null}

      {panelState === "waiting" && qrDataUrl ? (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Inquadra questo codice con la fotocamera di un dispositivo già fidato, e apri il link
            che ti propone --- senza digitare nulla qui.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI generato al volo, non un asset statico */}
          <img src={qrDataUrl} alt="Codice per sbloccare da un dispositivo fidato" className="h-56 w-56 self-center" />
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">In attesa di conferma…</p>
        </>
      ) : null}

      {panelState === "expired" ? (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Il codice è scaduto senza essere usato.
          </p>
          <button
            type="button"
            onClick={handleOpen}
            className="self-start rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Genera un nuovo codice
          </button>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleClose}
        className="self-start text-xs font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        Annulla, usa invece la master password
      </button>
    </div>
  );
}
