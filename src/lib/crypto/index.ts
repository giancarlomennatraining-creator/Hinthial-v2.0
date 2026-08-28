/**
 * HINTHIAL encryption module --- FASE 3 (Crypto foundation).
 *
 * Isolated, storage-agnostic and UI-agnostic: this module only knows how
 * to generate/derive/wrap/unwrap keys and encrypt/decrypt bytes. It has
 * no knowledge of Supabase, documents-as-database-rows, or any page.
 *
 * See PROTOCOL.md for the full design (key hierarchy, algorithms,
 * serialized formats, what this does NOT do yet) and
 * HINTHIAL_MVP.md sezione 3 for the product-level requirements this
 * implements.
 *
 * Not production-ready without a professional security review.
 */

export * from "@/lib/crypto/envelope";
export * from "@/lib/crypto/errors";
export * from "@/lib/crypto/pbkdf2";
export * from "@/lib/crypto/recovery-key";
export * from "@/lib/crypto/master-key";
export * from "@/lib/crypto/document-key";
export { encryptBytes, decryptBytes } from "@/lib/crypto/aes-gcm";
export { generateSymmetricKey, exportKeyRaw, importKeyRaw } from "@/lib/crypto/symmetric-key";
export { wrapKey, unwrapKey } from "@/lib/crypto/key-wrapping";
export { wipe } from "@/lib/crypto/memory";
export { randomBytes } from "@/lib/crypto/random";
export { bytesToBase64, base64ToBytes, utf8ToBytes, bytesToUtf8 } from "@/lib/crypto/codec";
