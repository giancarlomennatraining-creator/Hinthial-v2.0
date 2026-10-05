/**
 * FASE 19: il permesso di scrivere. Una proposta ha sempre cosa propone (campo+valore), da dove nasce (`source`), tre
 * risposte (accetta/modifica/rifiuta) e reversibilità (v. proposal_rejections). Vincolo architetturale: il server
 * propone, solo il client scrive --- le proposte si calcolano nel browser, il server non le vede mai nascere.
 */

/**
 * Campi proponibili oggi: expires_at, category_id, encrypted_issuer (cifrato come le note), e "field" --- un
 * campo eterogeneo aperto (numero polizza, targa, ...) che vive in encrypted_structured_fields, governato da un
 * vocabolario personale (v. domain/structured-fields) invece di una colonna dedicata. Data del documento resta
 * visibile ma non proponibile, manca un campo che l'accolga. "event" è una data da ricordare (rinnovo, pagamento,
 * visita): accettarla non cambia il documento, crea una scadenza in Scadenze collegata ad esso.
 */
/** "asset" collega il documento a un bene (`value` = id del bene): v. domain/assets/link-proposal. */
export type ProposalKind = "expiry" | "category" | "issuer" | "field" | "event" | "asset";

export interface Proposal {
  kind: ProposalKind;
  /** ISO `YYYY-MM-DD` per una scadenza o un evento, id della categoria per una categoria, testo libero per issuer/field. */
  value: string;
  /** Il pezzo di documento da cui nasce, da mostrare accanto alla proposta. */
  source: string;
  /** Solo per le proposte di Hinthia su un documento letto per pagine: il numero di pagina (da 1) da cui nasce. */
  page?: number;
  /** Vero se il valore è calcolato e non letto (es. "controllo tra 12 mesi" + data documento) --- chi accetta deve saperlo. */
  derived?: boolean;
  /** Vero se il candidato viene da Claude (analisi esplicita, consenso a parte). */
  aiGenerated?: boolean;
  /** Solo per kind "field": la chiave normalizzata (v. normalizeFieldKey) --- dove il valore va scritto. */
  fieldKey?: string;
  /** Solo per kind "field": l'etichetta leggibile, registrata nel vocabolario alla prima accettazione. */
  fieldLabel?: string;
  /** Solo per kind "event": come si chiamerà la scadenza creata in Scadenze. */
  eventTitle?: string;
}

/** Un rifiuto già espresso, letto e decifrato --- v. proposal_rejections. */
export interface ProposalRejection {
  id: string;
  kind: ProposalKind;
  value: string;
  /** Solo per kind "field" --- senza, il rifiuto di un valore su una chiave collisionerebbe con lo stesso valore su un'altra. */
  fieldKey?: string;
}
