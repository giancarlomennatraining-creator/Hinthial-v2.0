// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useVaultState } from "@/lib/use-vault-state";
import { clearVaultCache, invalidateVault, VAULT } from "@/lib/vault-store";

const key = {} as CryptoKey;

beforeEach(() => clearVaultCache());

describe("useVaultState", () => {
  it("senza una copia parte dal valore vuoto e dice che non c'era", () => {
    const { result } = renderHook(() => useVaultState<string[]>(key, VAULT.assets, []));
    expect(result.current[0]).toEqual([]);
    expect(result.current[2]).toBe(false);
  });

  it("ciò che si imposta resta per la pagina dopo, che parte già con i dati", () => {
    const first = renderHook(() => useVaultState<string[]>(key, VAULT.assets, []));
    act(() => first.result.current[1](["a", "b"]));
    first.unmount();

    const second = renderHook(() => useVaultState<string[]>(key, VAULT.assets, []));
    expect(second.result.current[0]).toEqual(["a", "b"]);
    expect(second.result.current[2]).toBe(true);
  });

  it("accetta anche la forma con funzione, e aggiorna la copia", () => {
    const first = renderHook(() => useVaultState<string[]>(key, VAULT.assets, []));
    act(() => first.result.current[1](["a"]));
    act(() => first.result.current[1]((previous) => [...previous, "b"]));
    first.unmount();
    const second = renderHook(() => useVaultState<string[]>(key, VAULT.assets, []));
    expect(second.result.current[0]).toEqual(["a", "b"]);
  });

  it("il valore vuoto di partenza non finisce in memoria: la pagina dopo non lo scambia per 'già letto'", () => {
    const first = renderHook(() => useVaultState<string[]>(key, VAULT.assets, []));
    first.unmount();
    const second = renderHook(() => useVaultState<string[]>(key, VAULT.assets, []));
    expect(second.result.current[2]).toBe(false);
  });

  it("dopo una scrittura (invalidazione) la pagina dopo riparte da zero", () => {
    const first = renderHook(() => useVaultState<string[]>(key, VAULT.assets, []));
    act(() => first.result.current[1](["a"]));
    first.unmount();
    invalidateVault(VAULT.assets);
    const second = renderHook(() => useVaultState<string[]>(key, VAULT.assets, []));
    expect(second.result.current[2]).toBe(false);
  });
});
