/**
 * Come si presenta la finestra di sblocco della master key. Non è una scelta: su un dispositivo fidato (con impronta o
 * Face ID registrati, v. DeviceLockPanel) si tocca l'anello "Impronta", altrimenti si vede la lastra di "Vetro" con la
 * password. Lo sblocco è sempre lo stesso (v. UnlockDialog): cambia solo l'aspetto e le animazioni.
 */

export type UnlockStyle = "glass" | "fingerprint";

/** La pelle di questo dispositivo: l'impronta se il dispositivo è fidato, altrimenti il vetro. */
export function unlockStyleFor(deviceLockAvailable: boolean): UnlockStyle {
  return deviceLockAvailable ? "fingerprint" : "glass";
}

/** Quanto dura l'animazione di uscita di ogni pelle, dallo sblocco riuscito alla finestra scomparsa. */
export const UNLOCK_EXIT_MS: Record<UnlockStyle, number> = {
  glass: 1100,
  fingerprint: 1100,
};
