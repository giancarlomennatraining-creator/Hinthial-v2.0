/** La miniatura da dare al prossimo caricamento: la semina la prepara prima di `uploadDocument`, che nel browser la disegnerebbe da sé. */
let next: Blob | null = null;

export function setNextThumbnail(bytes: Buffer | null): void {
  next = bytes ? new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }) : null;
}

export function takeThumbnail(): Blob | null {
  const blob = next;
  next = null;
  return blob;
}
