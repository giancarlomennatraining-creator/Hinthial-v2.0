/**
 * Content Intelligence, PR2: tipi condivisi dall'analisi a blocchi. Niente di qui dipende da Anthropic: il provider
 * (v. AnalysisProvider) è l'unico punto che lo conosce, e vive lato server.
 */

/** Un pezzo del documento a cui si può ancorare ciò che si ricava: una pagina, o una sezione se le pagine non ci sono. */
export interface AnalysisSegment {
  /** Stabile dentro l'analisi: `p3` (pagina 3), `p3.2` (seconda parte di una pagina molto lunga), `s5` (sezione). */
  id: string;
  /** Numero di pagina reale (da 1), o null per una sezione ricavata dal solo testo. */
  page: number | null;
  text: string;
}

/** Ciò che parte verso il provider in una singola richiesta: uno o più segmenti, ognuno preceduto dal suo marcatore `[[id]]`. */
export interface AnalysisBlock {
  id: string;
  segmentIds: string[];
  text: string;
}

/** Una lettura come la restituisce il modello: il valore, dove l'ha trovato e la citazione che lo prova. Non ancora verificata. */
export interface RawEvidence {
  value: string;
  segmentId: string;
  quote: string;
}

export interface RawFieldEvidence extends RawEvidence {
  key: string;
  label: string;
}

export interface RawCategoryEvidence {
  id: string;
  segmentId: string;
  quote: string;
}

/** L'output strutturato del modello per un blocco, dopo il controllo di forma ma prima di quello sul contenuto. */
export interface RawBlockAnalysis {
  /** Presente solo se al modello è stato chiesto di scegliere il tipo (primo blocco). */
  documentType: string | null;
  expiry: RawEvidence[];
  issuer: RawEvidence[];
  category: RawCategoryEvidence | null;
  fields: RawFieldEvidence[];
  /** Lettura d'insieme del blocco: derivata, non ha una citazione. */
  synthesis: string | null;
}

export interface VocabularyEntry {
  field_key: string;
  label: string;
}

export interface AnalyzeBlockInput {
  block: AnalysisBlock;
  categories: { id: string; name: string }[];
  vocabulary: VocabularyEntry[];
  /** Id del tipo già scelto sui blocchi precedenti; null = da scegliere ora. */
  documentType: string | null;
}

/**
 * L'interfaccia minima di un motore di analisi: oggi solo Claude (src/lib/ai/claude-analysis-provider.ts). Entrambe le
 * funzioni restituiscono dati già controllati nella forma, oppure lanciano AnalysisOutputError: un output non valido
 * non viene mai accettato.
 */
export interface AnalysisProvider {
  analyzeBlock(input: AnalyzeBlockInput): Promise<RawBlockAnalysis>;
  /** Fonde le sintesi parziali di più blocchi in una sola. */
  mergeSyntheses(partials: string[]): Promise<string | null>;
}

export class AnalysisOutputError extends Error {
  constructor(message = "Il motore di analisi ha risposto in un formato non valido.") {
    super(message);
    this.name = "AnalysisOutputError";
  }
}
