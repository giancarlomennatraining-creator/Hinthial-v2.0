/**
 * FASE 7: solo struttura dati e gestione dello stato --- nessuno sblocco
 * automatico dei dati in questa fase (v. HINTHIAL_MVP.md).
 */
export type TrustedContactStatus = "pending" | "active" | "revoked";

export interface TrustedContactListItem {
  id: string;
  /** Decrypted client-side for display. */
  name: string;
  email: string;
  /** Free text (es. "Coniuge", "Avvocato", "Fratello") --- non cifrato, etichetta gestionale. */
  role: string;
  status: TrustedContactStatus;
  /**
   * "Amico" --- riceve un avviso informale se il proprietario risulta
   * inattivo a lungo (Dead Man's Switch semplificato per le capsule, v.
   * domain/capsules). Nessuna conferma richiesta da parte sua, nessun
   * accesso concesso: solo un flag, come `status`.
   */
  isFriend: boolean;
  createdAt: string;
}

export interface TrustedContactInput {
  name: string;
  email: string;
  role: string;
}
