import { describe, expect, it } from "vitest";
import {
  bytesToUtf8,
  decryptBytes,
  deriveSharedKeyAsRecipient,
  deriveSharedKeyAsSender,
  encryptBytes,
  generateSymmetricKey,
  setupKeyPair,
  unwrapPrivateKey,
  utf8ToBytes,
} from "@/lib/crypto";
import { MAX_REPLY_LENGTH, normalizeReply, parseReplyPayload, repliesLabel } from "@/domain/capsules/replies";

describe("normalizeReply", () => {
  it("toglie gli spazi attorno e rifiuta il vuoto", () => {
    expect(normalizeReply("  Grazie.  \n")).toBe("Grazie.");
    expect(normalizeReply("")).toBeNull();
    expect(normalizeReply("   \n ")).toBeNull();
  });

  it("accetta fino al limite e rifiuta oltre", () => {
    expect(normalizeReply("a".repeat(MAX_REPLY_LENGTH))).toHaveLength(MAX_REPLY_LENGTH);
    expect(normalizeReply("a".repeat(MAX_REPLY_LENGTH + 1))).toBeNull();
  });
});

describe("parseReplyPayload", () => {
  it("riconosce un pensiero ben formato", () => {
    const payload = { authorName: "Marco Rossi", message: "Grazie.", writtenAt: "2038-03-12T10:00:00.000Z" };
    expect(parseReplyPayload(payload)).toEqual(payload);
  });

  it("scarta ciò che non ha la forma giusta, senza rompere", () => {
    expect(parseReplyPayload(null)).toBeNull();
    expect(parseReplyPayload("testo")).toBeNull();
    expect(parseReplyPayload({ authorName: "A", message: "x" })).toBeNull();
    expect(parseReplyPayload({ authorName: "A", message: "   ", writtenAt: "2038-03-12" })).toBeNull();
    expect(parseReplyPayload({ authorName: 3, message: "x", writtenAt: "2038-03-12" })).toBeNull();
  });
});

describe("repliesLabel", () => {
  it("singolare e plurale", () => {
    expect(repliesLabel(1)).toBe("1 pensiero");
    expect(repliesLabel(3)).toBe("3 pensieri");
  });
});

describe("il pensiero cifrato per il proprietario", () => {
  it("chi lo scrive lo cifra con la chiave pubblica del proprietario, e solo il proprietario lo legge", async () => {
    // Il proprietario ha una coppia di chiavi, con la privata cifrata dalla sua Master Key.
    const ownerMasterKey = await generateSymmetricKey();
    const setup = await setupKeyPair(ownerMasterKey);

    // Chi riceve cifra con la pubblica del proprietario (la sola cosa che conosce) e butta la chiave effimera.
    const { sharedKey, ephemeralPublicKeyJwk } = await deriveSharedKeyAsSender(setup.publicKeyJwk);
    const text = JSON.stringify({ authorName: "Marco Rossi", message: "Grazie, l'ho letta tre volte.", writtenAt: "2038-03-12T10:00:00.000Z" });
    const encrypted = await encryptBytes(sharedKey, utf8ToBytes(text));

    // Il proprietario ridrive la stessa chiave con la propria privata e legge.
    const ownerPrivateKey = await unwrapPrivateKey(ownerMasterKey, setup.wrappedPrivateKey);
    const ownerSharedKey = await deriveSharedKeyAsRecipient(ownerPrivateKey, ephemeralPublicKeyJwk);
    expect(bytesToUtf8(await decryptBytes(ownerSharedKey, encrypted))).toBe(text);

    // Un altro account non lo legge.
    const strangerMasterKey = await generateSymmetricKey();
    const stranger = await setupKeyPair(strangerMasterKey);
    const strangerPrivateKey = await unwrapPrivateKey(strangerMasterKey, stranger.wrappedPrivateKey);
    const strangerSharedKey = await deriveSharedKeyAsRecipient(strangerPrivateKey, ephemeralPublicKeyJwk);
    await expect(decryptBytes(strangerSharedKey, encrypted)).rejects.toThrow();
  });
});
