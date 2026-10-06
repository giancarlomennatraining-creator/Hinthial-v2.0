import type { AnalysisOverview, OverviewFact } from "@/domain/ai/analysis/overview";
import { ANALYSIS_SCHEMAS, ANALYSIS_DOCUMENT_TYPES } from "@/domain/ai/analysis/schemas";
import type { Provenance } from "@/domain/ai/analysis/validate";
import type { Proposal, ProposalRejection } from "@/domain/proposals/types";
import { formatDate } from "@/lib/format";

/**
 * Il "registro di lettura": un solo elenco al posto di "Proposte" e "Cosa ha letto Hinthia". Ogni riga è una cosa che
 * Hinthia ha trovato (o proposto) e dice a che punto è: da decidere, già nella Scheda, scartata, o solo da leggere.
 * Puro: nessuna rete, nessun database; le righe si ricalcolano a ogni render dai dati già in pagina.
 */

export type RegisterGroup = "Documento" | "Dettagli" | "Importi e date" | "Collegamenti";

export const REGISTER_GROUPS: RegisterGroup[] = ["Documento", "Dettagli", "Importi e date", "Collegamenti"];

export type RegisterRowState = "pending" | "adopted" | "rejected" | "info";

export interface RegisterRow {
  /** Stabile tra un render e l'altro: serve a riconoscere la riga che passa da "da decidere" a "nella Scheda". */
  id: string;
  group: RegisterGroup;
  label: string;
  /** Già formattato per la lettura (data in italiano, nome della categoria o del bene). */
  value: string;
  /** La frase del documento che lo prova, o per un dato calcolato da che cosa deriva. */
  quote: string | null;
  provenance: Provenance | null;
  state: RegisterRowState;
  /** Presente solo se la riga è "da decidere": è ciò che Accetta/Modifica/No grazie applicano. */
  proposal: Proposal | null;
  /** Presente solo se la riga è "scartata": serve a ripristinarla. */
  rejection: ProposalRejection | null;
  /** "nella Scheda", "creato e collegato", "in Scadenze"... */
  adoptedLabel: string;
  /** Solo per le righe "info": perché non si può accettare (es. "Già passata"). */
  note: string | null;
  /** Il fatto letto da cui nasce, se c'è: per aprire la pagina d'origine. */
  fact: OverviewFact | null;
}

const FIELD_VALUE_TYPE = new Map<string, string>();
for (const id of ANALYSIS_DOCUMENT_TYPES) {
  for (const field of ANALYSIS_SCHEMAS[id].fields) FIELD_VALUE_TYPE.set(field.key, field.valueType);
}

const AMOUNT_LIKE = /(?:\bEUR\b|€|\$|£)|\d[\d.]*,\d{2}\b/i;

/** Importi e date vanno insieme, il resto (numeri, nomi, modelli) tra i dettagli. */
function groupOfField(fact: OverviewFact): RegisterGroup {
  const type = FIELD_VALUE_TYPE.get(fact.id.replace(/^field-/, ""));
  if (type === "amount" || type === "date") return "Importi e date";
  if (type === "text" || type === "identifier") return "Dettagli";
  return fact.valueType === "date" || AMOUNT_LIKE.test(fact.value) ? "Importi e date" : "Dettagli";
}

function factDisplay(fact: OverviewFact): string {
  return fact.valueType === "date" ? formatDate(fact.value) : fact.value;
}

function proposalDisplay(
  proposal: Proposal,
  categories: { id: string; name: string }[],
  assets: { id: string; name: string }[],
): string {
  switch (proposal.kind) {
    case "expiry":
      return formatDate(proposal.value);
    case "event":
      return `${proposal.eventTitle ?? "Evento"} · ${formatDate(proposal.value)}`;
    case "category":
      return categories.find((c) => c.id === proposal.value)?.name ?? proposal.value;
    case "asset":
      return proposal.createAsset ? `Nuovo bene: ${proposal.value}` : (assets.find((a) => a.id === proposal.value)?.name ?? "Bene");
    default:
      return proposal.value;
  }
}

function matches(proposal: Proposal, fact: OverviewFact): boolean {
  switch (proposal.kind) {
    case "expiry":
    case "event":
    case "issuer":
      return proposal.kind === fact.kind && proposal.value === fact.value;
    case "category":
      return fact.kind === "category";
    case "field":
      return fact.kind === "field" && fact.id === `field-${proposal.fieldKey}`;
    default:
      return false;
  }
}

const KIND_LABEL: Record<Proposal["kind"], string> = {
  expiry: "Scadenza",
  category: "Categoria",
  issuer: "Emittente",
  field: "Campo",
  event: "Da ricordare",
  asset: "Bene",
};

function proposalActionLabel(proposal: Proposal): string {
  if (proposal.kind === "event") return "in Scadenze";
  if (proposal.kind === "asset") return proposal.createAsset ? "creato e collegato" : "collegato";
  return "nella Scheda";
}

export interface BuildRegisterInput {
  overview: AnalysisOverview | null;
  proposals: Proposal[];
  rejections: ProposalRejection[];
  categories: { id: string; name: string }[];
  assets: { id: string; name: string }[];
  /** Oggi, `YYYY-MM-DD`: una data da ricordare già passata non si può aggiungere a Scadenze. */
  today: string;
}

export function buildRegisterRows(input: BuildRegisterInput): RegisterRow[] {
  const { overview, proposals, rejections, categories, assets, today } = input;
  const rows: RegisterRow[] = [];
  const used = new Set<Proposal>();

  if (overview) {
    rows.push({
      id: "type",
      group: "Documento",
      label: "Tipo di documento",
      value: overview.typeLabel,
      quote: overview.typeRecognized ? null : "Non rientra in un tipo noto.",
      provenance: null,
      state: "info",
      proposal: null,
      rejection: null,
      adoptedLabel: "",
      note: "Solo lettura",
      fact: null,
    });

    for (const fact of overview.facts) {
      const proposal = proposals.find((p) => !used.has(p) && matches(p, fact)) ?? null;
      if (proposal) used.add(proposal);

      const rejection =
        rejections.find((r) => {
          if (r.kind !== fact.kind) return false;
          if (fact.kind === "field") return r.fieldKey === fact.id.replace(/^field-/, "") && r.value === fact.value;
          if (fact.kind === "category") return categories.find((c) => c.id === r.value)?.name === fact.value;
          return r.value === fact.value;
        }) ?? null;

      let state: RegisterRowState;
      let note: string | null = null;
      if (proposal) state = "pending";
      else if (fact.adopted) state = "adopted";
      else if (rejection) state = "rejected";
      else {
        state = "info";
        note = fact.kind === "event" && fact.value < today ? "Già passata" : "Hai già un altro valore";
      }

      const isEvent = fact.kind === "event";
      rows.push({
        id: fact.id,
        group: fact.kind === "event" ? "Collegamenti" : fact.kind === "field" ? groupOfField(fact) : "Documento",
        label: isEvent ? "Da ricordare" : fact.label,
        value: isEvent ? `${fact.label} · ${formatDate(fact.value)}` : factDisplay(fact),
        quote: fact.quote,
        provenance: fact.provenance,
        state,
        proposal,
        rejection: state === "rejected" ? rejection : null,
        adoptedLabel: isEvent ? "in Scadenze" : "nella Scheda",
        note,
        fact,
      });
    }
  }

  // Proposte senza una lettura che le spieghi: la categoria dedotta dal tipo, il bene da collegare o da creare.
  proposals.forEach((proposal, index) => {
    if (used.has(proposal)) return;
    rows.push({
      id: `proposal-${proposal.kind}-${proposal.fieldKey ?? ""}-${index}`,
      group: proposal.kind === "asset" || proposal.kind === "event" ? "Collegamenti" : "Documento",
      label: KIND_LABEL[proposal.kind],
      value: proposalDisplay(proposal, categories, assets),
      quote: proposal.source,
      provenance: null,
      state: "pending",
      proposal,
      rejection: null,
      adoptedLabel: proposalActionLabel(proposal),
      note: null,
      fact: null,
    });
  });

  // Dentro un gruppo: categoria, emittente, scadenza, poi il resto nell'ordine di lettura.
  const ORDER: Record<string, number> = { category: 0, issuer: 1, expiry: 2 };
  const rank = (row: RegisterRow) => (row.id === "type" ? -1 : (ORDER[row.fact?.kind ?? row.proposal?.kind ?? ""] ?? 3));
  return REGISTER_GROUPS.flatMap((group) =>
    rows
      .map((row, position) => ({ row, position }))
      .filter(({ row }) => row.group === group)
      .sort((a, b) => (group === "Documento" ? rank(a.row) - rank(b.row) : 0) || a.position - b.position)
      .map(({ row }) => row),
  );
}

/** Quante righe contano per il progresso: tutte tranne quelle di sola lettura. */
export function registerProgress(rows: RegisterRow[]): { adopted: number; pending: number; total: number } {
  const counted = rows.filter((r) => r.state !== "info");
  return {
    adopted: counted.filter((r) => r.state === "adopted").length,
    pending: counted.filter((r) => r.state === "pending").length,
    total: counted.length,
  };
}
