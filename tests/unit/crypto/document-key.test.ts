import { describe, expect, it } from "vitest";
import { decryptDocument, encryptDocument } from "@/lib/crypto/document-key";
import { generateSymmetricKey } from "@/lib/crypto/symmetric-key";
import { utf8ToBytes, bytesToUtf8 } from "@/lib/crypto/codec";
import { DecryptionError } from "@/lib/crypto/errors";

describe("per-document encryption", () => {
  it("round-trips a document's content", async () => {
    const masterKey = await generateSymmetricKey();
    const encrypted = await encryptDocument(masterKey, utf8ToBytes("contenuto del documento"));
    const decrypted = await decryptDocument(masterKey, encrypted);

    expect(bytesToUtf8(decrypted)).toBe("contenuto del documento");
  });

  it("gives every document its own key", async () => {
    const masterKey = await generateSymmetricKey();
    const a = await encryptDocument(masterKey, utf8ToBytes("documento A"));
    const b = await encryptDocument(masterKey, utf8ToBytes("documento B"));

    expect(a.wrappedDocumentKey.ciphertext).not.toBe(b.wrappedDocumentKey.ciphertext);
  });

  it("fails to decrypt with the wrong master key", async () => {
    const masterKey = await generateSymmetricKey();
    const otherMasterKey = await generateSymmetricKey();
    const encrypted = await encryptDocument(masterKey, utf8ToBytes("segreto"));

    await expect(decryptDocument(otherMasterKey, encrypted)).rejects.toThrow(DecryptionError);
  });

  it("fails to decrypt if the document key envelope was tampered with", async () => {
    const masterKey = await generateSymmetricKey();
    const encrypted = await encryptDocument(masterKey, utf8ToBytes("segreto"));

    const tampered = {
      ...encrypted,
      wrappedDocumentKey: { ...encrypted.wrappedDocumentKey, ciphertext: "AAAAAAAAAAAAAAAA" },
    };

    await expect(decryptDocument(masterKey, tampered)).rejects.toThrow(DecryptionError);
  });
});
