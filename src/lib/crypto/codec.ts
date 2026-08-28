/**
 * Browser-safe binary <-> text helpers (no Node `Buffer`, so this works
 * unmodified in the browser).
 */

// Chunked rather than one char at a time: repeatedly concatenating a
// single character is unnecessarily slow (and memory-hungry) for large
// arrays, since each `+=` still involves building up a huge amount of
// intermediate string state.
const BASE64_CHUNK_SIZE = 8192;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error("Invalid base64 input.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function utf8ToBytes(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
