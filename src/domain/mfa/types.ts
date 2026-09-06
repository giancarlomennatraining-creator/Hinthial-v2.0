export interface TotpEnrollment {
  factorId: string;
  /** Markup SVG grezzo --- va convertito in data URI prima di usarlo come `src` di un'immagine (v. repository.ts). */
  qrCodeSvg: string;
  /** Fallback per chi non può inquadrare il QR: da inserire a mano nell'app authenticator. */
  secret: string;
}

export interface MfaFactor {
  id: string;
  friendlyName: string;
  /** ISO. */
  createdAt: string;
}
