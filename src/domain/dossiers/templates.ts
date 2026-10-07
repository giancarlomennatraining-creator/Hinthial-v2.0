import { matchExpected } from "@/domain/dossiers/expected";
import type { DocumentSummary } from "@/domain/documents/types";

/**
 * I modelli di fascicolo: partire da una vicenda che si conosce (comprare una casa, un incidente, una cura...) invece che da
 * un foglio bianco. Un modello propone le fasi, i documenti che servono di solito e, tra i documenti già in Hinthial,
 * quelli che sembrano già appartenerci. È solo un punto di partenza: tutto si può cambiare prima di creare, e poi
 * dalla scheda del fascicolo. Puro: nessuna rete, nessun database.
 */

export interface DossierTemplate {
  id: string;
  name: string;
  description: string;
  /** Il colore del modello e la sua tinta chiara, per la scheda. */
  color: string;
  tint: string;
  /** Il tracciato dell'icona (viewBox 24, linee). */
  icon: string;
  phases: string[];
  /** I documenti che servono di solito, nell'ordine in cui di solito arrivano. */
  expected: string[];
}

export const DOSSIER_TEMPLATES: DossierTemplate[] = [
  {
    id: "casa",
    name: "Acquisto di una casa",
    description: "Dalla ricerca alle chiavi: preliminare, mutuo, rogito, utenze.",
    color: "#2b4fc4",
    tint: "#e8edfc",
    icon: "M3 11l9-8 9 8 M5 10v10h14V10",
    phases: ["Ricerca", "Proposta", "Mutuo", "Rogito", "Chiavi in mano"],
    expected: [
      "Proposta d'acquisto",
      "Preliminare di compravendita",
      "Delibera del mutuo",
      "Perizia della banca",
      "Visura catastale",
      "Attestato di prestazione energetica",
      "Certificato di agibilità",
      "Atto di compravendita",
    ],
  },
  {
    id: "incidente",
    name: "Incidente d'auto",
    description: "Denuncia, perizia, preventivi e rimborso dell'assicurazione.",
    color: "#6d4fc4",
    tint: "#eeeafa",
    icon: "M5 17h14 M3 13l2-6h14l2 6v4H3Z M7 17v2 M17 17v2",
    phases: ["Denuncia", "Perizia", "Riparazione", "Rimborso"],
    expected: [
      "Constatazione amichevole",
      "Denuncia alla compagnia",
      "Foto dei danni",
      "Preventivo carrozzeria",
      "Fattura della riparazione",
      "Liquidazione del sinistro",
    ],
  },
  {
    id: "cura",
    name: "Cura medica",
    description: "Visite, esami, terapie e rimborsi, in un posto solo.",
    color: "#c2417a",
    tint: "#fae6ef",
    icon: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
    phases: ["Diagnosi", "Terapia", "Controlli"],
    expected: ["Referto di diagnosi", "Impegnativa", "Piano terapeutico", "Ricette", "Referti dei controlli", "Ricevute per la detrazione"],
  },
  {
    id: "lavori",
    name: "Ristrutturazione",
    description: "Preventivi, permessi, lavori, fatture e detrazioni fiscali.",
    color: "#0f8b8d",
    tint: "#e0f2f2",
    icon: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4Z",
    phases: ["Preventivi", "Permessi", "Lavori", "Collaudo", "Detrazioni"],
    expected: [
      "Preventivi a confronto",
      "Contratto con l'impresa",
      "Pratica edilizia (CILA)",
      "Fatture dei lavori",
      "Bonifici parlanti",
      "Dichiarazione di conformità",
    ],
  },
  {
    id: "successione",
    name: "Successione",
    description: "Dichiarazione, immobili, conti e imposte di un'eredità.",
    color: "#a9731a",
    tint: "#f8efdb",
    icon: "M12 2v6 M9 5h6 M5 22V12l7-4 7 4v10 M9 22v-6h6v6",
    phases: ["Dichiarazione", "Immobili", "Conti", "Imposte"],
    expected: [
      "Certificato di morte",
      "Testamento",
      "Dichiarazione di successione",
      "Visure degli immobili",
      "Estratti conto",
      "Ricevute delle imposte",
    ],
  },
  {
    id: "trasloco",
    name: "Trasloco",
    description: "Contratti, voltura delle utenze, residenza, preventivi.",
    color: "#475569",
    tint: "#eceff4",
    icon: "M3 7h11v10H3Z M14 10h4l3 3v4h-7 M7 20a2 2 0 1 0 0-4 M17 20a2 2 0 1 0 0-4",
    phases: ["Preparazione", "Trasloco", "Sistemazione"],
    expected: ["Contratto d'affitto", "Preventivo del trasloco", "Voltura luce e gas", "Cambio di residenza", "Disdetta del vecchio contratto"],
  },
  {
    id: "lavoro",
    name: "Nuovo lavoro",
    description: "Contratto, buste paga, previdenza e benefit.",
    color: "#1c7c5a",
    tint: "#e3f4ec",
    icon: "M4 7h16v12H4Z M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2",
    phases: ["Offerta", "Contratto", "Primi mesi"],
    expected: ["Lettera d'offerta", "Contratto di lavoro", "Buste paga", "Iscrizione previdenziale", "Polizza sanitaria aziendale"],
  },
  {
    id: "nascita",
    name: "Nascita di un figlio",
    description: "Atto di nascita, pediatra, bonus, assicurazioni.",
    color: "#e0762a",
    tint: "#fcece0",
    icon: "M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M6 22v-6a6 6 0 0 1 12 0v6",
    phases: ["Nascita", "Registrazioni", "Bonus e detrazioni"],
    expected: ["Atto di nascita", "Codice fiscale", "Scelta del pediatra", "Domanda di bonus", "Aggiunta alla polizza sanitaria"],
  },
];

export function templateMeta(template: DossierTemplate): string {
  return `${template.phases.length} fasi · ${template.expected.length} documenti attesi`;
}

export interface TemplateMatch {
  documentId: string;
  filename: string;
  /** La voce del modello che il documento sembra soddisfare. */
  expectedLabel: string;
}

/**
 * I documenti già in Hinthial che sembrano appartenere al modello: quelli che nominano una delle sue voci (stesso
 * abbinamento dei documenti attesi) e non stanno già in un fascicolo. Un documento per voce, e solo uguaglianze di parole:
 * meglio uno in meno che uno di troppo.
 */
export function findTemplateMatches(
  template: Pick<DossierTemplate, "expected">,
  documents: Pick<DocumentSummary, "id" | "filename" | "issuer" | "notes" | "tags" | "structuredFields" | "dossierIds">[],
): TemplateMatch[] {
  const free = documents.filter((doc) => doc.dossierIds.length === 0);
  const summary = matchExpected(
    template.expected.map((label, index) => ({ id: String(index), label, done: false })),
    free as DocumentSummary[],
  );
  return summary.statuses
    .filter((status) => status.documentId !== null)
    .map((status) => ({
      documentId: status.documentId as string,
      filename: status.documentName as string,
      expectedLabel: status.item.label,
    }));
}
