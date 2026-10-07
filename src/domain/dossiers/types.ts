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

import type { DossierPhases } from "@/domain/dossiers/phases";

export type DossierStatus = "open" | "closed";

/** Il riassunto scritto da Hinthia sui documenti del fascicolo (v. api/ai/dossier-summary), salvato cifrato. */
export interface DossierSummary {
  text: string;
  /** ISO: quando è stato scritto. */
  generatedAt: string;
  /** Quanti documenti sono entrati nel riassunto. */
  documentCount: number;
  /**
   * Quanti documenti letti da Hinthia c'erano quando è stato scritto (anche quelli rimasti fuori per mancato permesso):
   * se poi ne arrivano altri, il riassunto risulta da aggiornare. Assente nei riassunti vecchi: vale documentCount.
   */
  readableCount?: number;
}

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
  /** Le tappe della vicenda, se l'utente le ha scelte. */
  phases: DossierPhases | null;
  /** Il riassunto di Hinthia, se l'utente l'ha chiesto. */
  summary: DossierSummary | null;
}

export interface DossierInput {
  title: string;
  description: string;
}
