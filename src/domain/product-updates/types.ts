/**
 * "Novità" in Dashboard --- un registro di prodotto rivolto all'utente
 * (v. domain/product-updates/repository.ts), ispirato a CHANGELOG.md ma
 * non equivalente: qui solo le modifiche che vale la pena raccontare a
 * chi usa Hinthial, in un linguaggio amichevole rivolto a "te", non ogni
 * singolo dettaglio tecnico registrato lì.
 */
export interface ProductUpdateListItem {
  id: string;
  title: string;
  description: string;
  /** ISO (yyyy-mm-dd) --- solo la data, mai un orario: non serve qui. */
  publishedOn: string;
}
