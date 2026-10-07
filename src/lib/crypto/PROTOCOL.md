# HINTHIAL --- Encryption protocol (FASE 3)

Status: **MVP implementation, not production-ready.** Every primitive
here is a standard, browser-native Web Crypto API algorithm --- nothing
here is a custom-designed cipher, KDF or protocol. Before relying on
this for real user data, get it reviewed by a security professional
(see HINTHIAL_MVP.md sezione 3 and 14).

## Goals

- Encryption happens **client-side**, before anything is sent to the
  server (see `src/lib/db/supabase/*`, which only ever stores what this
  module has already encrypted).
- The server never sees the master password, a document's plaintext, or
  any unwrapped key.
- A user can recover their data with either their master password or a
  separately generated recovery key --- losing one doesn't lock them out
  if they still have the other.
- Each document gets its own key, so revoking/rotating access to one
  document never requires touching any other document's ciphertext
  (needed later for sharing/capsules --- not implemented yet, see below).

## Key hierarchy

```
Master Password ---PBKDF2---> Password-Derived Key (PDK) --------\
                                                                    > wraps Master Key (MK)
Recovery Key (random, shown once) ---HKDF---> Recovery-Derived Key /

Master Key (MK, random AES-256) ---wraps---> Document Key (DK, random AES-256, one per document)

Document Key (DK) ---encrypts---> document plaintext
```

- **Master Key (MK)**: a random AES-256-GCM key, generated once at
  account setup (`generateMasterKey`). It never leaves the client in
  plaintext form and is never used to encrypt document content directly
  --- only to wrap Document Keys. Keeping it a level removed from actual
  content means changing the master password is just "unwrap MK with the
  old PDK, wrap it again with the new one": no document ciphertext needs
  to be touched.
- **Password-Derived Key (PDK)**: derived from the master password via
  PBKDF2-HMAC-SHA256 (`deriveKeyFromPassword`), using a random salt and
  a high iteration count (`PBKDF2_ITERATIONS`, see FASE 3 note below).
  Used only to wrap/unwrap MK. Never stored, never sent anywhere.
- **Recovery Key (RK)**: 3072 bits of randomness (deliberately more than
  the 256 bits an AES-256 key needs --- HKDF condenses any amount of
  good input entropy down to the required output length; the extra
  length just makes the transcribed secret more visibly "random",
  harder to mistake for something guessable), generated once
  (`generateRecoveryKey`) and shown to the user a single time at setup
  as a human-transcribable hex string (`XXXX-XXXX-...`). A key is
  derived from it via HKDF-SHA256 (`deriveKeyFromRecoveryKey`, domain
  string `"hinthial:recovery-key:v1"`) and used, like the PDK, only to
  wrap/unwrap MK --- as an independent unlock path. HINTHIAL never stores
  the raw recovery key; only the user has it.
- **Document Key (DK)**: a random AES-256-GCM key generated per document
  (`generateDocumentKey`), wrapped by MK, and used to encrypt/decrypt
  that one document's content (`encryptDocument`/`decryptDocument`).

## Algorithms

| Purpose | Algorithm | Notes |
|---|---|---|
| Symmetric encryption | AES-256-GCM | authenticated (confidentiality + integrity); 96-bit random IV per encryption, never reused for the same key |
| Password -> key | PBKDF2-HMAC-SHA256 | `PBKDF2_ITERATIONS` iterations (600,000 by default --- OWASP 2023 minimum recommendation for PBKDF2-SHA256), random 16-byte salt |
| Recovery key -> key | HKDF-SHA256 | domain-separated via an `info` string so the same raw bytes can't be reused as a key for something else |
| Random bytes | `crypto.getRandomValues` | keys, salts, IVs |

All primitives come from the browser/runtime-native **Web Crypto API**
(`crypto.subtle`), per HINTHIAL_MVP.md sezione 3: "Non inventare
algoritmi crittografici. Non scrivere primitive crypto custom."

**Open point for the professional security review**: PBKDF2 is used
instead of a memory-hard KDF (Argon2id/scrypt) because it's natively
available in Web Crypto with no extra dependency, which matters for an
MVP. A memory-hard KDF would be more resistant to GPU/ASIC brute-force
and is worth adopting before this is considered production-ready.

## Serialized formats

Everything that needs to be stored or transmitted is a small,
versioned, JSON-safe object --- `parseEnvelope`/`parsePbkdf2Params` throw
a specific error type when the version is unrecognized or the shape is
invalid, rather than silently misinterpreting old/foreign data.

**Ciphertext envelope** (`EncryptedEnvelope`, used for wrapped keys and
document ciphertext alike):

```json
{ "v": 1, "alg": "AES-256-GCM", "iv": "<base64>", "ciphertext": "<base64>" }
```

**PBKDF2 parameters** (`Pbkdf2Params`, stored alongside the
password-wrapped MK so it can be re-derived on the next login):

```json
{ "v": 1, "alg": "PBKDF2-SHA256", "iterations": 600000, "salt": "<base64>" }
```

## Key material in memory

JavaScript gives no hard guarantee that memory is actually zeroed
(garbage collection and engine internals are out of this module's
control), so this is **best effort, not a security guarantee**:

- Wherever a key's raw bytes are briefly exported (e.g. to wrap it),
  `wipe()` overwrites that buffer with zeros as soon as it's no longer
  needed (see `key-wrapping.ts`).
- Keys derived for repeated use (PDK, RK-derived key, MK once unwrapped)
  are created as **non-extractable** `CryptoKey` objects by default:
  their raw bytes can never be read back out through this module's API,
  only used for encrypt/decrypt.

## Share links (dossiers shared with a professional)

Added after FASE 3, on top of this module (no new primitive): `src/domain/dossiers/shares-repository.ts` and
`src/domain/dossiers/sharing.ts`.

- The owner's device decrypts each chosen document (DK unwrapped with the MK), then re-encrypts the bytes with a fresh
  random **Share Key** (AES-256-GCM, `generateSymmetricKey`) and uploads the copies to a private bucket
  (`dossier-shares`, path `{owner}/{share}/{document}.json`, serialized `EncryptedEnvelope`).
- A manifest (title, description, document list, optional summary and phases) is encrypted with the Share Key and stored in
  `dossier_shares.encrypted_manifest`. The Share Key, encrypted with the MK, is stored in `encrypted_link_key` so the owner
  can copy the link again later. The label ("Notaio Rossi") is MK-encrypted like any user text.
- The Share Key travels **only in the URL fragment** (`/c/{share}#{base64url(key)}`). Browsers never send the fragment to
  the server, so the server stores and serves ciphertext it cannot read. The public page (`/c/[id]`) fetches the manifest
  and the copies through `/api/shares/...` (service role, no account), checks only "exists, not revoked, not expired, not
  purged", and decrypts in the visitor's browser.
- In clear on the server: expiry, whether download is allowed, document count, revocation state, access log
  (opened / which document / when). Everything else is ciphertext.
- Revoking, expiry (daily cron) and deleting the dossier remove the copies from Storage. The link then answers 404 with the
  same message as a wrong link.
- Honest limits: anyone holding the whole link can open the documents until it expires or is revoked (the link is a bearer
  credential, and an email carrying it passes through the mail provider); "view only" hides the download button but cannot
  stop a recipient from saving or photographing what they can see.

## What this module does NOT do (yet)

- **Account-to-account sharing with a recipient's public key.** The per-document key design (DK wrapped by MK) leaves room
  for it (capsules already wrap keys for linked friends); link-based sharing of dossiers is described above.
- **Storage/UI integration.** This module is intentionally isolated ---
  it doesn't know about Supabase, documents-as-database-rows, or any UI.
  That wiring is FASE 4 (Vault documentale).
- **Streaming/chunked encryption for very large files.** `encryptBytes`
  operates on one in-memory buffer; tested up to several MB (see FASE 3
  tests). Genuinely large files may need chunked encryption later.
- **Argon2id/scrypt.** See the open point above.
