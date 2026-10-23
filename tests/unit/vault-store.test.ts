import { beforeEach, describe, expect, it } from "vitest";
import { clearVaultCache, invalidateVault, peekVault, putVault, VAULT } from "@/lib/vault-store";

// Due "chiavi" qualunque: lo store le distingue per identità, non guarda dentro.
const keyA = {} as CryptoKey;
const keyB = {} as CryptoKey;

beforeEach(() => clearVaultCache());

describe("vault-store", () => {
  it("restituisce ciò che si è messo, per la stessa chiave", () => {
    putVault(keyA, VAULT.assets, [{ id: "1" }]);
    expect(peekVault(keyA, VAULT.assets)).toEqual([{ id: "1" }]);
    expect(peekVault(keyA, VAULT.documents)).toBeUndefined();
  });

  it("con un'altra chiave non si vede nulla, e la nuova chiave parte da zero", () => {
    putVault(keyA, VAULT.assets, ["a"]);
    expect(peekVault(keyB, VAULT.assets)).toBeUndefined();
    putVault(keyB, VAULT.documents, ["b"]);
    // La memoria di A è stata sostituita, non affiancata.
    expect(peekVault(keyA, VAULT.assets)).toBeUndefined();
    expect(peekVault(keyB, VAULT.documents)).toEqual(["b"]);
  });

  it("invalidare toglie solo i dati indicati", () => {
    putVault(keyA, VAULT.assets, ["a"]);
    putVault(keyA, VAULT.documents, ["d"]);
    invalidateVault(VAULT.assets);
    expect(peekVault(keyA, VAULT.assets)).toBeUndefined();
    expect(peekVault(keyA, VAULT.documents)).toEqual(["d"]);
  });

  it("al blocco si svuota tutto", () => {
    putVault(keyA, VAULT.assets, ["a"]);
    clearVaultCache();
    expect(peekVault(keyA, VAULT.assets)).toBeUndefined();
  });
});
