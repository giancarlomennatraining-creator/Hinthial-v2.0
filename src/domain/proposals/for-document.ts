import type { TypeCategoryOverrides } from "@/domain/ai/analysis/category-defaults";
import { buildAIProposals, extractedFieldsFrom, type AIExtractedFields } from "@/domain/ai/analyze-document";
import { buildAssetProposal, buildNewAssetProposal, type LinkedDocumentFields } from "@/domain/assets/link-proposal";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Proposal, ProposalRejection } from "@/domain/proposals/types";

/**
 * Le proposte di un documento: quelle che nascono dalla lettura di Silva (v. buildAIProposals) e il collegamento a un
 * bene (uno che c'è già, altrimenti uno da creare). Ricalcolate a ogni uso dallo stato attuale del documento: accettare o
 * rifiutare una proposta la filtra da sola, senza uno stato a parte. Puro: la scheda del documento e la schermata di
 * conferma dopo un'importazione usano la stessa funzione, così mostrano sempre le stesse proposte.
 */
export function proposalsForDocument(input: {
  doc: DocumentListItem;
  categories: { id: string; name?: string }[];
  typeCategories: TypeCategoryOverrides;
  assets: { id: string; name: string }[];
  linkedFields: LinkedDocumentFields[];
  rejections: ProposalRejection[];
  /** I giorni delle scadenze già collegate al documento: un evento letto che c'è già non si ripropone. */
  reminderDates: string[];
  today: string;
}): { proposals: Proposal[]; aiFields: AIExtractedFields | null } {
  const { doc, categories, typeCategories, assets, linkedFields, rejections, reminderDates, today } = input;
  const aiFields = doc.contentAnalysis ? extractedFieldsFrom(doc.contentAnalysis, categories, typeCategories) : null;
  const readIdentifiers = aiFields?.fields.map((f) => ({ key: f.key, value: f.value })) ?? [];
  // Prima un bene che c'è già (lo stesso identificativo di un documento collegato), altrimenti uno da creare.
  const assetProposal =
    buildAssetProposal({ doc, readFields: readIdentifiers, linked: linkedFields, assets, rejections }) ??
    buildNewAssetProposal({ doc, readFields: readIdentifiers, assets, rejections });
  const proposals = [
    ...(aiFields ? buildAIProposals(doc, aiFields, rejections, { today, existingDates: reminderDates }) : []),
    ...(assetProposal ? [assetProposal] : []),
  ];
  return { proposals, aiFields };
}

/**
 * Le proposte "sicure" da accettare in blocco: una sola per tipo (per "campo": per chiave), con più candidati della stessa
 * cosa vince la prima, non si sovrascrive in sequenza. Un evento non scrive nella Scheda e il collegamento a un bene tocca
 * un'altra cosa dell'utente: restano da confermare uno per uno.
 */
export function onePerSlot(proposals: Proposal[]): Proposal[] {
  const seen = new Set<string>();
  return proposals.filter((proposal) => {
    if (proposal.kind === "event" || proposal.kind === "asset") return false;
    const slot = proposal.kind === "field" ? `field:${proposal.fieldKey}` : proposal.kind;
    if (seen.has(slot)) return false;
    seen.add(slot);
    return true;
  });
}
