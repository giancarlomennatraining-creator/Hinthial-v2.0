import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  bytesToUtf8,
  decryptBytes,
  encryptBytes,
  parseEnvelope,
  serializeEnvelope,
  utf8ToBytes,
} from "@/lib/crypto";
import { logAuditEvent } from "@/lib/audit/log-event";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Proposal, ProposalKind, ProposalRejection } from "@/domain/proposals/types";

/**
 * FASE 19: le tre risposte a una proposta. Scadenza/categoria accettate finiscono in chiaro (lo erano già); l'emittente
 * si cifra come le note (testo libero, non un id/data). Il valore rifiutato è sempre cifrato, altrimenti il server
 * vedrebbe un dato che senza questa fase non esisterebbe.
 */

/** Ciò che serve per rimettere le cose com'erano --- v. undoAcceptance. */
export interface AcceptedProposal {
  kind: ProposalKind;
  /** Il valore che il campo aveva **prima**: null se era vuoto. */
  previousValue: string | null;
}

/** null/vuoto in -> null out, come encryptOptionalText in documents/repository.ts. */
async function encryptIssuerValue(masterKey: CryptoKey, value: string | null): Promise<string | null> {
  if (!value?.trim()) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(value)));
}

/** Unione esplicita, non chiave calcolata --- TypeScript non verificherebbe una chiave dinamica, e qui un refuso scriverebbe nel campo sbagliato. */
type DocumentsTableUpdate = Database["public"]["Tables"]["documents"]["Update"];

async function updateFor(
  masterKey: CryptoKey,
  kind: ProposalKind,
  value: string | null,
): Promise<Pick<DocumentsTableUpdate, "expires_at" | "category_id" | "encrypted_issuer">> {
  if (kind === "expiry") return { expires_at: value };
  if (kind === "category") return { category_id: value };
  return { encrypted_issuer: await encryptIssuerValue(masterKey, value) };
}

function currentValue(doc: DocumentListItem, kind: ProposalKind): string | null {
  if (kind === "expiry") return doc.expiresAt;
  if (kind === "category") return doc.categoryId;
  return doc.issuer || null;
}

/** `value` è a parte, non preso dalla proposta: è lo stesso percorso di "modifica", accettare tal quale o corretto è la stessa operazione. */
export async function acceptProposal(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  doc: DocumentListItem,
  kind: ProposalKind,
  value: string,
): Promise<AcceptedProposal> {
  const previousValue = currentValue(doc, kind);

  const { error } = await supabase
    .from("documents")
    .update(await updateFor(masterKey, kind, value))
    .eq("id", doc.id);

  if (error) {
    throw new Error(`Impossibile applicare la proposta: ${error.message}`);
  }

  // In Attività resta traccia del *tipo*, mai del valore: gli audit non devono contenere contenuti.
  await logAuditEvent(supabase, ownerId, "proposal_accepted");

  return { kind, previousValue };
}

/** Rimette il campo com'era prima di un'accettazione. */
export async function undoAcceptance(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  documentId: string,
  accepted: AcceptedProposal,
): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update(await updateFor(masterKey, accepted.kind, accepted.previousValue))
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile annullare: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "proposal_undone");
}

/**
 * Rifiuta una proposta, e se lo ricorda. Restituisce l'id della riga,
 * che è ciò che serve a "Annulla" per cancellarla.
 */
export async function rejectProposal(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  documentId: string,
  proposal: Proposal,
): Promise<string> {
  const encryptedValue = serializeEnvelope(
    await encryptBytes(masterKey, utf8ToBytes(proposal.value)),
  );

  const { data, error } = await supabase
    .from("proposal_rejections")
    .insert({
      owner_id: ownerId,
      document_id: documentId,
      kind: proposal.kind,
      encrypted_value: encryptedValue,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Impossibile registrare il rifiuto: ${error?.message}`);
  }

  await logAuditEvent(supabase, ownerId, "proposal_rejected");

  return data.id;
}

/** Cancella un rifiuto: la proposta torna a comparire. */
export async function undoRejection(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  rejectionId: string,
): Promise<void> {
  const { error } = await supabase.from("proposal_rejections").delete().eq("id", rejectionId);
  if (error) {
    throw new Error(`Impossibile annullare: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "proposal_undone");
}

/** Rifiuti già espressi, decifrati --- il confronto con le proposte nuove avviene sul client, unico posto possibile. */
export async function listProposalRejections(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
): Promise<ProposalRejection[]> {
  const { data, error } = await supabase
    .from("proposal_rejections")
    .select("id, kind, encrypted_value")
    .eq("document_id", documentId);

  if (error) {
    throw new Error(`Impossibile caricare le decisioni precedenti: ${error.message}`);
  }

  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      kind: row.kind as ProposalKind,
      value: bytesToUtf8(await decryptBytes(masterKey, parseEnvelope(row.encrypted_value))),
    })),
  );
}
