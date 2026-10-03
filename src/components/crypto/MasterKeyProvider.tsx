"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getLocalUserId } from "@/lib/auth/local-user";
import { createClient } from "@/lib/db/supabase/client";
import {
  setupMasterKey,
  unlockMasterKeyWithPassword,
  unlockMasterKeyWithRecoveryKey,
  setupKeyPair,
  serializeEnvelope,
  serializePbkdf2Params,
  parseEnvelope,
  parsePbkdf2Params,
  wrapKey,
  unwrapKey,
  isDeviceLockSupported,
  registerDeviceCredential,
  deriveDeviceKeyForCredential,
  generateEphemeralKeyPair,
  deriveSharedKeyAsRecipient,
  type MasterKeySetup,
} from "@/lib/crypto";
import {
  getDeviceLockRecord,
  setDeviceLockRecord,
  clearDeviceLockRecord,
} from "@/lib/device-lock-storage";
import {
  registerTrustedDevice,
  findActiveTrustedDevice,
  touchTrustedDeviceLastActive,
  forgetTrustedDevice,
} from "@/domain/trusted-devices/repository";
import { logAuditEvent } from "@/lib/audit/log-event";
import {
  createPairingRequest,
  checkPairingRequestApproved,
  deletePairingRequest,
} from "@/domain/device-pairing/repository";

export type MasterKeyStatus =
  | { kind: "checking" }
  | { kind: "not-set-up" }
  | { kind: "locked" }
  | { kind: "unlocked"; masterKey: CryptoKey };

interface MasterKeyContextValue {
  status: MasterKeyStatus;
  /** Generates a new setup (does NOT persist it) --- caller shows the recovery key and calls `confirmSetup` only after it's saved (see SetupMasterKeyForm). */
  setup: (password: string) => Promise<{ setup: MasterKeySetup; masterKey: CryptoKey }>;
  /** Persists a setup produced by `setup()` and unlocks it. */
  confirmSetup: (setup: MasterKeySetup, masterKey: CryptoKey) => Promise<void>;
  unlockWithPassword: (password: string) => Promise<void>;
  unlockWithRecoveryKey: (formattedRecoveryKey: string) => Promise<void>;
  lock: () => void;
  // Dispositivi fidati (v. lib/crypto/device-lock.ts).
  /** `null` finché non ancora verificato --- evita un lampo "non disponibile" mentre il controllo è in corso. */
  deviceLockSupported: boolean | null;
  /** true se questo browser ha già una registrazione locale per l'utente corrente. */
  deviceLockAvailable: boolean;
  /** Sblocca usando la copia locale del Master Key, protetta da WebAuthn --- mai chiamata se `deviceLockAvailable` è false. */
  unlockWithDeviceLock: () => Promise<void>;
  /** Registra questo dispositivo come fidato --- richiede di nuovo la master password: l'unico modo di ottenere una copia esportabile del Master Key in tutta l'app. */
  registerDeviceLock: (password: string, label: string) => Promise<void>;
  /** "Dimentica questo dispositivo": rimuove la registrazione qui e sul server. */
  forgetDeviceLock: () => Promise<void>;
  // Pairing tra dispositivi via QR (v. domain/device-pairing/repository.ts): il dispositivo nuovo genera una richiesta come QR, un dispositivo già fidato la approva scansionandola.
  /** Apre una nuova richiesta di pairing --- v. DevicePairingUnlock.tsx per l'uso (QR + attesa). */
  startDevicePairing: () => Promise<{ requestId: string; pairingUrl: string; privateKey: CryptoKey }>;
  /** Un giro di controllo: `true` se approvata (e il vault è già sbloccato a questo punto), `false` se non ancora. */
  tryCompleteDevicePairing: (requestId: string, privateKey: CryptoKey) => Promise<boolean>;
  /** Annulla una richiesta non ancora approvata (es. l'utente chiude il pannello prima che qualcuno scansioni). */
  cancelDevicePairing: (requestId: string) => Promise<void>;
}

const MasterKeyContext = createContext<MasterKeyContextValue | null>(null);

async function requireUserId(): Promise<{
  supabase: ReturnType<typeof createClient>;
  userId: string;
  userEmail: string;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Devi essere autenticato.");
  }
  return { supabase, userId: user.id, userEmail: user.email ?? user.id };
}

export function MasterKeyProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<MasterKeyStatus>({ kind: "checking" });
  const [deviceLockSupported, setDeviceLockSupported] = useState<boolean | null>(null);
  const [deviceLockAvailable, setDeviceLockAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      // Solo per sapere se la cassaforte esiste: l'id dalla sessione locale, senza un viaggio di rete in più a ogni apertura.
      const userId = await getLocalUserId(supabase);
      if (!userId || cancelled) return;

      const { data } = await supabase
        .from("encryption_setup")
        .select("owner_id")
        .eq("owner_id", userId)
        .maybeSingle();

      if (!cancelled) {
        setStatus(data ? { kind: "locked" } : { kind: "not-set-up" });
        setDeviceLockAvailable(getDeviceLockRecord(userId) !== null);
      }
    })();

    // Indipendente dallo stato di cifratura: solo una domanda al browser, non tocca l'account.
    isDeviceLockSupported().then((supported) => {
      if (!cancelled) setDeviceLockSupported(supported);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setup = useCallback(async (password: string) => {
    const result = await setupMasterKey(password);
    const masterKey = await unlockMasterKeyWithPassword(
      password,
      result.pbkdf2Params,
      result.masterKeyWrappedByPassword,
    );
    return { setup: result, masterKey };
  }, []);

  const confirmSetup = useCallback(async (result: MasterKeySetup, masterKey: CryptoKey) => {
    const { supabase, userId } = await requireUserId();

    // Ogni account guadagna qui la propria coppia di chiavi ECDH (v. lib/crypto/keypair.ts), garantita presente fin dal primo momento per una futura condivisione di capsule.
    const keyPair = await setupKeyPair(masterKey);

    const { error } = await supabase.from("encryption_setup").insert({
      owner_id: userId,
      master_key_wrapped_by_password: serializeEnvelope(result.masterKeyWrappedByPassword),
      master_key_wrapped_by_recovery_key: serializeEnvelope(result.masterKeyWrappedByRecoveryKey),
      pbkdf2_params: serializePbkdf2Params(result.pbkdf2Params),
      public_key: keyPair.publicKeyJwk,
      wrapped_private_key: serializeEnvelope(keyPair.wrappedPrivateKey),
    });
    if (error) {
      throw new Error(`Impossibile salvare la configurazione di cifratura: ${error.message}`);
    }

    setStatus({ kind: "unlocked", masterKey });
  }, []);

  /** Sanamento pigro: un account creato prima delle coppie di chiavi ne riceve una qui, al primo sblocco. Best-effort: un fallimento non impedisce lo sblocco, si riprova al prossimo. */
  const ensureKeyPair = useCallback(
    async (
      supabase: ReturnType<typeof createClient>,
      userId: string,
      masterKey: CryptoKey,
      existingPublicKey: string | null,
    ) => {
      if (existingPublicKey) return;
      try {
        const keyPair = await setupKeyPair(masterKey);
        await supabase
          .from("encryption_setup")
          .update({
            public_key: keyPair.publicKeyJwk,
            wrapped_private_key: serializeEnvelope(keyPair.wrappedPrivateKey),
          })
          .eq("owner_id", userId);
      } catch {
        // Best-effort --- v. commento sopra.
      }
    },
    [],
  );

  const unlockWithPassword = useCallback(
    async (password: string) => {
      const { supabase, userId } = await requireUserId();

      const { data, error } = await supabase
        .from("encryption_setup")
        .select("master_key_wrapped_by_password, pbkdf2_params, public_key")
        .eq("owner_id", userId)
        .single();
      if (error || !data) {
        throw new Error("Configurazione di cifratura non trovata.");
      }

      const masterKey = await unlockMasterKeyWithPassword(
        password,
        parsePbkdf2Params(data.pbkdf2_params),
        parseEnvelope(data.master_key_wrapped_by_password),
      );
      void ensureKeyPair(supabase, userId, masterKey, data.public_key);
      setStatus({ kind: "unlocked", masterKey });
    },
    [ensureKeyPair],
  );

  const unlockWithRecoveryKey = useCallback(
    async (formattedRecoveryKey: string) => {
      const { supabase, userId } = await requireUserId();

      const { data, error } = await supabase
        .from("encryption_setup")
        .select("master_key_wrapped_by_recovery_key, public_key")
        .eq("owner_id", userId)
        .single();
      if (error || !data) {
        throw new Error("Configurazione di cifratura non trovata.");
      }

      const masterKey = await unlockMasterKeyWithRecoveryKey(
        formattedRecoveryKey,
        parseEnvelope(data.master_key_wrapped_by_recovery_key),
      );
      void ensureKeyPair(supabase, userId, masterKey, data.public_key);
      setStatus({ kind: "unlocked", masterKey });
    },
    [ensureKeyPair],
  );

  /** Sblocco via la copia locale del Master Key, cifrata con una chiave WebAuthn (v. lib/crypto/device-lock.ts). La verifica server (findActiveTrustedDevice) serve solo ad accorgersi se il dispositivo è stato revocato altrove: senza, la revoca sarebbe cosmetica. */
  const unlockWithDeviceLock = useCallback(async () => {
    const { supabase, userId } = await requireUserId();

    const record = getDeviceLockRecord(userId);
    if (!record) {
      throw new Error("Nessun dispositivo fidato registrato qui per questo account.");
    }

    const activeDevice = await findActiveTrustedDevice(supabase, userId, record.credentialId);
    if (!activeDevice) {
      clearDeviceLockRecord(userId);
      setDeviceLockAvailable(false);
      throw new Error("Questo dispositivo non è più fidato — sblocca con la master password.");
    }

    const deviceKey = await deriveDeviceKeyForCredential(record.credentialId);
    const masterKey = await unwrapKey(deviceKey, parseEnvelope(record.wrappedMasterKey));

    void touchTrustedDeviceLastActive(supabase, activeDevice.id);
    setStatus({ kind: "unlocked", masterKey });
  }, []);

  /** Registra questo dispositivo come fidato: richiede di nuovo la master password, unico modo di ottenere una copia esportabile del Master Key (v. lib/crypto/master-key.ts). */
  const registerDeviceLock = useCallback(async (password: string, label: string) => {
    const { supabase, userId, userEmail } = await requireUserId();

    const { data, error } = await supabase
      .from("encryption_setup")
      .select("master_key_wrapped_by_password, pbkdf2_params")
      .eq("owner_id", userId)
      .single();
    if (error || !data) {
      throw new Error("Configurazione di cifratura non trovata.");
    }

    const extractableMasterKey = await unlockMasterKeyWithPassword(
      password,
      parsePbkdf2Params(data.pbkdf2_params),
      parseEnvelope(data.master_key_wrapped_by_password),
      true,
    );

    const { credentialId, deviceKey } = await registerDeviceCredential(userId, userEmail);
    const wrappedMasterKey = await wrapKey(deviceKey, extractableMasterKey);

    const { id } = await registerTrustedDevice(supabase, userId, credentialId, label);
    void logAuditEvent(supabase, userId, "trusted_device_registered");
    setDeviceLockRecord(userId, {
      deviceId: id,
      credentialId,
      wrappedMasterKey: serializeEnvelope(wrappedMasterKey),
    });
    setDeviceLockAvailable(true);
  }, []);

  const forgetDeviceLock = useCallback(async () => {
    const { supabase, userId } = await requireUserId();
    const record = getDeviceLockRecord(userId);
    if (!record) return;

    await forgetTrustedDevice(supabase, record.deviceId);
    void logAuditEvent(supabase, userId, "trusted_device_revoked");
    clearDeviceLockRecord(userId);
    setDeviceLockAvailable(false);
  }, []);

  /** Lato dispositivo nuovo: la chiave privata effimera resta solo in memoria, mai salvata --- se la pagina si chiude prima dell'approvazione, la richiesta resta inutilizzabile finché non scade. */
  const startDevicePairing = useCallback(async () => {
    const { supabase, userId } = await requireUserId();
    const { privateKey, publicKeyJwk } = await generateEphemeralKeyPair();
    const request = await createPairingRequest(supabase, userId, publicKeyJwk);
    const pairingUrl = `${window.location.origin}/pair/${request.id}`;
    return { requestId: request.id, pairingUrl, privateKey };
  }, []);

  const tryCompleteDevicePairing = useCallback(async (requestId: string, privateKey: CryptoKey) => {
    const { supabase } = await requireUserId();
    const approved = await checkPairingRequestApproved(supabase, requestId);
    if (!approved) return false;

    const sharedKey = await deriveSharedKeyAsRecipient(privateKey, approved.approverPublicKey);
    const masterKey = await unwrapKey(sharedKey, parseEnvelope(approved.encryptedMasterKey));
    // Nessun ensureKeyPair qui: la coppia di chiavi è quasi certamente già presente da uno sblocco precedente altrove; se mancasse, verrà creata al prossimo sblocco con password o impronta.
    void deletePairingRequest(supabase, requestId);
    setStatus({ kind: "unlocked", masterKey });
    return true;
  }, []);

  const cancelDevicePairing = useCallback(async (requestId: string) => {
    const { supabase } = await requireUserId();
    await deletePairingRequest(supabase, requestId);
  }, []);

  const lock = useCallback(() => setStatus({ kind: "locked" }), []);

  const value = useMemo<MasterKeyContextValue>(
    () => ({
      status,
      setup,
      confirmSetup,
      unlockWithPassword,
      unlockWithRecoveryKey,
      lock,
      deviceLockSupported,
      deviceLockAvailable,
      unlockWithDeviceLock,
      registerDeviceLock,
      forgetDeviceLock,
      startDevicePairing,
      tryCompleteDevicePairing,
      cancelDevicePairing,
    }),
    [
      status,
      setup,
      confirmSetup,
      unlockWithPassword,
      unlockWithRecoveryKey,
      lock,
      deviceLockSupported,
      deviceLockAvailable,
      unlockWithDeviceLock,
      registerDeviceLock,
      forgetDeviceLock,
      startDevicePairing,
      tryCompleteDevicePairing,
      cancelDevicePairing,
    ],
  );

  return <MasterKeyContext.Provider value={value}>{children}</MasterKeyContext.Provider>;
}

export function useMasterKey(): MasterKeyContextValue {
  const ctx = useContext(MasterKeyContext);
  if (!ctx) {
    throw new Error("useMasterKey must be used within a MasterKeyProvider");
  }
  return ctx;
}
