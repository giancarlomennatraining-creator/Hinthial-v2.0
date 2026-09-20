/**
 * FASE 20 --- Fascicoli: vicende che durano nel tempo (un problema di
 * salute, l'acquisto di una casa, un incidente) e attraversano più
 * categorie. Una categoria è un cassetto; un fascicolo è la storia che
 * mette insieme documenti che vivono in cassetti diversi.
 *
 * Creazione e collegamento sono manuali in questa fase (v.
 * HINTHIAL_MVP.md): nessuna proposta automatica --- quella arriva con la
 * FASE 21, sui raggruppamenti evidenti di un caricamento massivo.
 */

export type DossierStatus = "open" | "closed";

export interface DossierListItem {
  id: string;
  /** Decrypted client-side for display. */
  title: string;
  /** "" if never written --- v. domain/documents/types.ts, `notes`. */
  description: string;
  status: DossierStatus;
  createdAt: string;
  /** null finché è aperto. */
  closedAt: string | null;
}

export interface DossierInput {
  title: string;
  description: string;
}
