import { DEVICE_LOCK_HKDF_INFO, DEVICE_LOCK_PRF_SALT_LABEL } from "@/lib/crypto/constants";
import { utf8ToBytes, bytesToBase64, base64ToBytes } from "@/lib/crypto/codec";
import { CryptoModuleError } from "@/lib/crypto/errors";

/**
 * "Rendere fidato" questo dispositivo così può sbloccare il vault con l'impronta/Face ID (WebAuthn, autenticatore
 * di piattaforma) invece della master password. Non è login: l'account resta autenticato come sempre (Supabase
 * Auth), questo protegge solo una copia locale del Master Key, mai vista dal server (v. lib/device-lock-storage.ts).
 * L'estensione PRF calcola una funzione pseudo-random legata alla credenziale, mai esponendo il segreto sottostante:
 * l'input a HKDF è l'output del PRF invece che i byte grezzi di un segreto scelto dall'utente (v. recovery-key.ts
 * per lo stesso schema). Non ogni browser supporta ancora l'estensione PRF (v. isDeviceLockSupported, controllo
 * esplicito): dove non disponibile, resta un'opzione non offerta, la master password resta sempre disponibile.
 */

const RP_NAME = "Hinthial";
const CREATE_TIMEOUT_MS = 60_000;

async function prfEvalSalt(): Promise<Uint8Array<ArrayBuffer>> {
  const digest = await crypto.subtle.digest("SHA-256", utf8ToBytes(DEVICE_LOCK_PRF_SALT_LABEL));
  return new Uint8Array(digest);
}

/** Deriva una chiave AES-256-GCM non estraibile dall'output del PRF di WebAuthn, stesso schema di deriveKeyFromRecoveryKey con un input diverso. */
async function deriveKeyFromPrfOutput(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", prfOutput, "HKDF", false, [
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: utf8ToBytes(DEVICE_LOCK_HKDF_INFO),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Lanciato quando l'autenticatore non supporta l'estensione PRF (v. isDeviceLockSupported). */
export class DeviceLockUnsupportedError extends CryptoModuleError {
  constructor(message = "Questo dispositivo/browser non supporta il blocco biometrico locale.") {
    super(message);
    this.name = "DeviceLockUnsupportedError";
  }
}

/** Vero controllo di supporto: non solo "WebAuthn esiste" ma "un autenticatore di piattaforma con PRF è davvero disponibile qui". */
export async function isDeviceLockSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    const platformAvailable =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!platformAvailable) return false;
    // getClientCapabilities segnala se l'estensione prf è nota al browser; se assente, si tenta comunque la registrazione reale (più affidabile su qualche piattaforma).
    const withCapabilities = PublicKeyCredential as unknown as {
      getClientCapabilities?: () => Promise<Record<string, boolean>>;
    };
    if (typeof withCapabilities.getClientCapabilities === "function") {
      const capabilities = await withCapabilities.getClientCapabilities();
      if (capabilities.extension_prf === false) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Registra una nuova credenziale WebAuthn di piattaforma, poi deriva subito la chiave AES-GCM che protegge il
 * Master Key --- due cerimonie separate (create, poi get) perché l'estensione PRF restituisce un valore affidabile
 * solo così su ogni piattaforma. `userId`/`userEmail` identificano l'account solo verso l'autenticatore locale, mai verso il server.
 */
export async function registerDeviceCredential(
  userId: string,
  userEmail: string,
): Promise<{ credentialId: string; deviceKey: CryptoKey }> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = utf8ToBytes(userId);

  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME },
      user: { id: userIdBytes, name: userEmail, displayName: userEmail },
      challenge,
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256, fallback
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      extensions: { prf: {} },
      timeout: CREATE_TIMEOUT_MS,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new DeviceLockUnsupportedError();
  }

  const credentialId = bytesToBase64(new Uint8Array(credential.rawId));
  const deviceKey = await deriveDeviceKeyForCredential(credentialId);
  return { credentialId, deviceKey };
}

/** Rideriva la stessa chiave AES-256-GCM per una credenziale già registrata: l'estensione PRF è deterministica per la stessa coppia credenziale+salt, restituisce sempre la stessa chiave. */
export async function deriveDeviceKeyForCredential(credentialId: string): Promise<CryptoKey> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const salt = await prfEvalSalt();

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: base64ToBytes(credentialId), type: "public-key" }],
      userVerification: "required",
      extensions: { prf: { eval: { first: salt } } },
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new DeviceLockUnsupportedError();
  }

  const extensionResults = assertion.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer } };
  };
  const prfOutput = extensionResults.prf?.results?.first;
  if (!prfOutput) {
    throw new DeviceLockUnsupportedError(
      "L'autenticatore di questo dispositivo non ha restituito il valore atteso.",
    );
  }

  return deriveKeyFromPrfOutput(prfOutput);
}
