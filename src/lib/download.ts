/**
 * Triggers a browser download from an in-memory Blob --- never touches
 * the network, works purely client-side (a temporary object URL clicked
 * through a detached `<a download>`, then revoked).
 */
export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Same as `saveBlobAsFile`, starting from already-decrypted bytes. */
export function saveBytesAsFile(bytes: Uint8Array, filename: string, mimeType: string): void {
  saveBlobAsFile(
    new Blob([new Uint8Array(bytes)], { type: mimeType || "application/octet-stream" }),
    filename,
  );
}
