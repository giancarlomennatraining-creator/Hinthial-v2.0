import { describe, expect, it } from "vitest";
import {
  setupKeyPair,
  unwrapPrivateKey,
  deriveSharedKeyAsSender,
  deriveSharedKeyAsRecipient,
} from "@/lib/crypto/keypair";
import { generateSymmetricKey } from "@/lib/crypto/symmetric-key";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
import { utf8ToBytes, bytesToUtf8 } from "@/lib/crypto/codec";
import { DecryptionError } from "@/lib/crypto/errors";

describe("FASE C1 --- account key pair + ECDH key exchange", () => {
  it("wraps and unwraps the private key with the account's Master Key", async () => {
    const masterKey = await generateSymmetricKey();
    const setup = await setupKeyPair(masterKey);

    // Non lancia --- la chiave privata si sblocca con la stessa Master Key.
    const privateKey = await unwrapPrivateKey(masterKey, setup.wrappedPrivateKey);
    expect(privateKey.type).toBe("private");
    expect(privateKey.usages).toContain("deriveKey");
  });

  it("fails to unwrap the private key with the wrong Master Key", async () => {
    const masterKey = await generateSymmetricKey();
    const otherMasterKey = await generateSymmetricKey();
    const setup = await setupKeyPair(masterKey);

    await expect(unwrapPrivateKey(otherMasterKey, setup.wrappedPrivateKey)).rejects.toThrow(
      DecryptionError,
    );
  });

  it("gives every account its own key pair", async () => {
    const masterKey = await generateSymmetricKey();
    const a = await setupKeyPair(masterKey);
    const b = await setupKeyPair(masterKey);

    expect(a.publicKeyJwk).not.toBe(b.publicKeyJwk);
  });

  it("sender and recipient derive the exact same shared key from a single ECDH exchange", async () => {
    const recipientMasterKey = await generateSymmetricKey();
    const recipientSetup = await setupKeyPair(recipientMasterKey);
    const recipientPrivateKey = await unwrapPrivateKey(recipientMasterKey, recipientSetup.wrappedPrivateKey);

    const { sharedKey: senderKey, ephemeralPublicKeyJwk } = await deriveSharedKeyAsSender(
      recipientSetup.publicKeyJwk,
    );
    const recipientKey = await deriveSharedKeyAsRecipient(recipientPrivateKey, ephemeralPublicKeyJwk);

    // Le due CryptoKey non sono lo stesso oggetto, ma cifrano/decifrano
    // in modo intercambiabile --- prova che il segreto derivato è
    // davvero lo stesso su entrambi i lati.
    const encrypted = await encryptBytes(senderKey, utf8ToBytes("contenuto della capsula"));
    const decrypted = await decryptBytes(recipientKey, encrypted);
    expect(bytesToUtf8(decrypted)).toBe("contenuto della capsula");
  });

  it("a third party's key pair cannot derive the same shared key", async () => {
    const recipientMasterKey = await generateSymmetricKey();
    const recipientSetup = await setupKeyPair(recipientMasterKey);

    const strangerMasterKey = await generateSymmetricKey();
    const strangerSetup = await setupKeyPair(strangerMasterKey);
    const strangerPrivateKey = await unwrapPrivateKey(strangerMasterKey, strangerSetup.wrappedPrivateKey);

    const { sharedKey: senderKey, ephemeralPublicKeyJwk } = await deriveSharedKeyAsSender(
      recipientSetup.publicKeyJwk,
    );
    const strangerKey = await deriveSharedKeyAsRecipient(strangerPrivateKey, ephemeralPublicKeyJwk);

    const encrypted = await encryptBytes(senderKey, utf8ToBytes("segreto"));
    await expect(decryptBytes(strangerKey, encrypted)).rejects.toThrow(DecryptionError);
  });
});
