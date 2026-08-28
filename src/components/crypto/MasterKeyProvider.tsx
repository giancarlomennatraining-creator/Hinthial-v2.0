"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  setupMasterKey,
  unlockMasterKeyWithPassword,
  unlockMasterKeyWithRecoveryKey,
  serializeEnvelope,
  serializePbkdf2Params,
  parseEnvelope,
  parsePbkdf2Params,
  type MasterKeySetup,
} from "@/lib/crypto";

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
}

const MasterKeyContext = createContext<MasterKeyContextValue | null>(null);

async function requireUserId(): Promise<{ supabase: ReturnType<typeof createClient>; userId: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Devi essere autenticato.");
  }
  return { supabase, userId: user.id };
}

export function MasterKeyProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<MasterKeyStatus>({ kind: "checking" });

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
      }
    })();

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

    const { error } = await supabase.from("encryption_setup").insert({
      owner_id: userId,
      master_key_wrapped_by_password: serializeEnvelope(result.masterKeyWrappedByPassword),
      master_key_wrapped_by_recovery_key: serializeEnvelope(result.masterKeyWrappedByRecoveryKey),
      pbkdf2_params: serializePbkdf2Params(result.pbkdf2Params),
    });
    if (error) {
      throw new Error(`Impossibile salvare la configurazione di cifratura: ${error.message}`);
    }

    setStatus({ kind: "unlocked", masterKey });
  }, []);

  const unlockWithPassword = useCallback(async (password: string) => {
    const { supabase, userId } = await requireUserId();

    const { data, error } = await supabase
      .from("encryption_setup")
      .select("master_key_wrapped_by_password, pbkdf2_params")
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
    setStatus({ kind: "unlocked", masterKey });
  }, []);

  const unlockWithRecoveryKey = useCallback(async (formattedRecoveryKey: string) => {
    const { supabase, userId } = await requireUserId();

    const { data, error } = await supabase
      .from("encryption_setup")
      .select("master_key_wrapped_by_recovery_key")
      .eq("owner_id", userId)
      .single();
    if (error || !data) {
      throw new Error("Configurazione di cifratura non trovata.");
    }

    const masterKey = await unlockMasterKeyWithRecoveryKey(
      formattedRecoveryKey,
      parseEnvelope(data.master_key_wrapped_by_recovery_key),
    );
    setStatus({ kind: "unlocked", masterKey });
  }, []);

  const lock = useCallback(() => setStatus({ kind: "locked" }), []);

  const value = useMemo<MasterKeyContextValue>(
    () => ({ status, setup, confirmSetup, unlockWithPassword, unlockWithRecoveryKey, lock }),
    [status, setup, confirmSetup, unlockWithPassword, unlockWithRecoveryKey, lock],
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
