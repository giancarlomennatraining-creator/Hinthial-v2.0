"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

export type MasterKeyStatus =
  | { kind: "checking" }
  | { kind: "not-set-up" }
  | { kind: "locked" }
  | { kind: "unlocked"; masterKey: CryptoKey };

interface MasterKeyContextValue {
  status: MasterKeyStatus;
  /**
   * Generates a new Master Key setup for the current user (does NOT
   * persist it yet). The caller is responsible for showing the recovery
   * key to the user and calling `confirmSetup` only once they've
   * confirmed saving it --- see SetupMasterKeyForm.
   */
  setup: (password: string) => Promise<{ setup: MasterKeySetup; masterKey: CryptoKey }>;
  /** Persists a setup produced by `setup()` and unlocks it. */
  confirmSetup: (setup: MasterKeySetup, masterKey: CryptoKey) => Promise<void>;
  unlockWithPassword: (password: string) => Promise<void>;
  unlockWithRecoveryKey: (formattedRecoveryKey: string) => Promise<void>;
  lock: () => void;
  // FASE 13 --- dispositivi fidati (v. lib/crypto/device-lock.ts).
  /** `null` finché non ancora verificato --- evita un lampo "non disponibile" mentre il controllo è in corso. */
  deviceLockSupported: boolean | null;
  /** true se questo browser ha già una registrazione locale per l'utente corrente. */
  deviceLockAvailable: boolean;
  /** Sblocca usando la copia locale del Master Key, protetta da WebAuthn --- mai chiamata se `deviceLockAvailable` è false. */
  unlockWithDeviceLock: () => Promise<void>;
  /**
   * Registra questo dispositivo come fidato --- richiede di nuovo la
   * master password (anche se il vault è già sbloccato in questa
   * sessione): l'unico modo di ottenere una copia esportabile del
   * Master Key, l'unica concessione a questa garanzia in tutta l'app
   * (v. lib/crypto/master-key.ts).
   */
  registerDeviceLock: (password: string, label: string) => Promise<void>;
  /** "Dimentica questo dispositivo": rimuove la registrazione qui e sul server. */
  forgetDeviceLock: () => Promise<void>;
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data } = await supabase
        .from("encryption_setup")
        .select("owner_id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setStatus(data ? { kind: "locked" } : { kind: "not-set-up" });
        setDeviceLockAvailable(getDeviceLockRecord(user.id) !== null);
      }
    })();

    // Indipendente dallo stato di cifratura --- solo una domanda al
    // browser, non tocca l'account.
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

    // FASE C1: ogni account guadagna qui la propria coppia di chiavi
    // ECDH (v. lib/crypto/keypair.ts) --- così è garantita presente fin
    // dal primo momento, per quando qualcuno vorrà condividere una
    // capsula con questo account.
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

  /**
   * FASE C1, sanamento pigro: un account creato prima di questa fase
   * non ha ancora una coppia di chiavi --- gliene viene generata una qui,
   * al primo sblocco successivo, così diventa comunque raggiungibile da
   * chi in futuro vorrà condividere una capsula con lui. Best-effort:
   * un fallimento non deve impedire lo sblocco stesso, si riprova al
   * prossimo (v. backfillOpenAtColumn per lo stesso principio altrove).
   */
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

  /**
   * FASE 13 --- sblocco via la copia locale del Master Key, cifrata con
   * una chiave derivata da WebAuthn (v. lib/crypto/device-lock.ts). La
   * verifica lato server (findActiveTrustedDevice) non è lì per
   * "autenticare" --- l'account è già autenticato come sempre --- ma per
   * accorgersi se questo dispositivo è stato revocato da un'altra
   * sessione nel frattempo: senza, la revoca sarebbe solo cosmetica.
   */
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
      throw new Error("Questo dispositivo non è più fidato --- sblocca con la master password.");
    }

    const deviceKey = await deriveDeviceKeyForCredential(record.credentialId);
    const masterKey = await unwrapKey(deviceKey, parseEnvelope(record.wrappedMasterKey));

    void touchTrustedDeviceLastActive(supabase, activeDevice.id);
    setStatus({ kind: "unlocked", masterKey });
  }, []);

  /**
   * Registra questo dispositivo come fidato. Richiede di nuovo la
   * master password anche se il vault è già sbloccato in questa
   * sessione --- v. il commento su `registerDeviceLock` nel tipo del
   * contesto: è l'unico modo di ottenere una copia esportabile del
   * Master Key, mai altrimenti concessa (v. lib/crypto/master-key.ts).
   */
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
    clearDeviceLockRecord(userId);
    setDeviceLockAvailable(false);
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
