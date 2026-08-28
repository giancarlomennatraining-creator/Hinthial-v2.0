/**
 * Best-effort zeroing of key material after use.
 *
 * JavaScript gives no hard guarantee that memory is actually wiped ---
 * garbage collection, JIT-internal copies, and engine internals are out
 * of this module's control. This reduces the window during which
 * sensitive bytes sit in a buffer we still hold a reference to; it is
 * not a substitute for a real secure-memory audit (see PROTOCOL.md).
 */
export function wipe(bytes: Uint8Array): void {
  bytes.fill(0);
}
