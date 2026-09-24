/**
 * FASE 19: il permesso di scrivere. Una proposta ha sempre cosa propone (campo+valore), da dove nasce (`source`), tre
 * risposte (accetta/modifica/rifiuta) e reversibilità (v. proposal_rejections). Vincolo architetturale: il server
 * propone, solo il client scrive --- le proposte si calcolano nel browser, il server non le vede mai nascere.
 */

/** Campi proponibili oggi: expires_at, category_id, e (cifrato come le note) encrypted_issuer. Data del documento resta visibile ma non proponibile, manca un campo che l'accolga. */
export type ProposalKind = "expiry" | "category" | "issuer";

export interface Proposal {
  kind: ProposalKind;
  /** ISO `YYYY-MM-DD` per una scadenza, id della categoria per una categoria. */
  value: string;
  /** Il pezzo di documento da cui nasce, da mostrare accanto alla proposta. */
  source: string;
  /** Vero se il valore è calcolato e non letto (es. "controllo tra 12 mesi" + data documento) --- chi accetta deve saperlo. */
  derived?: boolean;
}

/** Un rifiuto già espresso, letto e decifrato --- v. proposal_rejections. */
export interface ProposalRejection {
  id: string;
  kind: ProposalKind;
  value: string;
}
