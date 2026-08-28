export class CryptoModuleError extends Error {}

/** Wrong key, or the ciphertext was corrupted/tampered with. */
export class DecryptionError extends CryptoModuleError {
  constructor(message = "Decryption failed: wrong key or corrupted/tampered data.") {
    super(message);
    this.name = "DecryptionError";
  }
}

/** A serialized envelope/params object is malformed. */
export class InvalidFormatError extends CryptoModuleError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFormatError";
  }
}

/** A serialized envelope/params object has a version this module doesn't understand. */
export class UnsupportedVersionError extends CryptoModuleError {
  constructor(version: unknown) {
    super(`Unsupported format version: ${JSON.stringify(version)}`);
    this.name = "UnsupportedVersionError";
  }
}
