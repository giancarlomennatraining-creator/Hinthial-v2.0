"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { peekVault, putVault, type VaultKey } from "@/lib/vault-store";

/**
 * Come `useState`, ma parte dall'ultima copia in memoria (se c'è, v. lib/vault-store.ts) e ogni valore impostato la aggiorna. Il
 * terzo valore dice se c'era una copia: con una copia non serve lo scheletro. Si scrive in memoria solo ciò che si imposta, mai il
 * valore vuoto di partenza, altrimenti la pagina dopo scambierebbe "vuoto" per "già letto".
 */
export function useVaultState<T>(masterKey: CryptoKey, key: VaultKey, empty: T): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [cached] = useState(() => peekVault<T>(masterKey, key));
  const [value, setValue] = useState<T>(cached ?? empty);
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      setValue((previous) => {
        const resolved = typeof next === "function" ? (next as (prev: T) => T)(previous) : next;
        putVault(masterKey, key, resolved);
        return resolved;
      });
    },
    [masterKey, key],
  );
  return [value, set, cached !== undefined];
}
