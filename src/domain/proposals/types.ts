/**
 * FASE 19 --- il meccanismo delle proposte.
 *
 * Questa fase non porta funzioni nuove: porta il **permesso di
 * scrivere**. Fino alla 18 Hinthial ricavava informazioni dai documenti
 * e si limitava a mostrarle, perché modificare i dati di qualcuno senza
 * avere ancora il modo di disfare sarebbe stato scorretto. Qui nasce
 * quel modo, e con esso la possibilità di dire di sì.
 *
 * Quattro cose che una proposta deve avere, e che sono il contenuto
 * vero di questa fase:
 *
 * 1. **Cosa propone** --- un campo e un valore, mai un'azione vaga.
 * 2. **Da dove nasce** (`source`) --- il pezzo di documento che l'ha
 *    fatta nascere. Una proposta senza la sua fonte chiede fiducia
 *    cieca, ed è esattamente ciò che questo prodotto non fa.
 * 3. **Tre risposte, non due**: accetta, **modifica**, rifiuta. La
 *    seconda è quella che conta: la maggior parte delle proposte è
 *    giusta per metà --- la data c'è ma è quella sbagliata --- e senza
 *    "modifica" l'utente è costretto a rifiutare e rifare tutto a mano.
 * 4. **Reversibilità** --- un'accettazione si annulla, e un rifiuto si
 *    ricorda (v. proposal_rejections): ciò che hai scartato non ti viene
 *    richiesto.
 *
 * Vincolo architetturale della fase, dal piano: *il server può proporre,
 * solo il client può scrivere*. Qui è rispettato in modo strutturale ---
 * le proposte si calcolano nel browser dal testo già decifrato (v.
 * domain/extraction), e il server non le vede mai nascere.
 */

/**
 * I campi per cui oggi esiste una proposta. Sono i due che hanno una
 * casa dove essere scritti: `documents.expires_at` e
 * `documents.category_id`. Data del documento, importo ed emittente
 * (v. FASE 18) restano visibili nella scheda ma non proponibili --- non
 * c'è ancora un campo che li accolga, e inventarne uno per avere una
 * proposta in più sarebbe il contrario del lavorare per fasi.
 */
export type ProposalKind = "expiry" | "category";

export interface Proposal {
  kind: ProposalKind;
  /** ISO `YYYY-MM-DD` per una scadenza, id della categoria per una categoria. */
  value: string;
  /** Il pezzo di documento da cui nasce, da mostrare accanto alla proposta. */
  source: string;
  /**
   * Vero quando il valore è stato **calcolato** e non letto --- una
   * scadenza ricavata da "controllo tra dodici mesi" più la data del
   * documento (v. FASE 18). Va detto: chi accetta deve sapere se sta
   * confermando una data scritta sul foglio o un conto fatto da
   * Hinthial.
   */
  derived?: boolean;
}

/** Un rifiuto già espresso, letto e decifrato --- v. proposal_rejections. */
export interface ProposalRejection {
  id: string;
  kind: ProposalKind;
  value: string;
}
