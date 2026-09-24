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
 * FASE 19 --- le tre risposte a una proposta, e il modo di tornare
 * indietro da ciascuna.
 *
 * Il valore accettato per scadenza/categoria finisce in chiaro nel
 * documento (`expires_at`, `category_id` lo sono già da sempre); quello
 * per l'emittente invece si cifra con la Master Key, come le note
 * (`encrypted_issuer`) --- è testo libero letto da un documento, non un
 * id o una data. Il valore **rifiutato**, per ogni tipo, viene sempre
 * cifrato con la Master Key, perché altrimenti questa fase
 * introdurrebbe sul server un dato che senza di essa non esisterebbe ---
 * v. la migrazione proposal_rejections per il ragionamento completo.
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

/**
 * La colonna che una proposta va a scrivere (e il valore, già cifrato
 * se serve). Scritta come unione e non come chiave calcolata
 * (`{ [colonna]: valore }`): TypeScript non riesce a verificare una
 * chiave dinamica contro lo schema, e accetterebbe qualunque nome di
 * colonna --- proprio qui, dove un refuso significa scrivere nel campo
 * sbagliato del documento di qualcuno.
 */
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

/**
 * Accetta una proposta: scrive il valore nel documento.
 *
 * `value` è passato a parte e non preso dalla proposta perché è lo
 * stesso percorso usato da "modifica": accettare una proposta corretta e
 * accettarne una corretta a mano sono la stessa operazione, e tenerle
 * separate vorrebbe dire due strade da mantenere allineate.
 */
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

  // In Attività resta traccia del *tipo* di proposta, mai del valore:
  // gli audit non devono contenere contenuti (v. lib/audit/log-event.ts).
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

/**
 * I rifiuti già espressi su un documento, decifrati. Il confronto con le
 * proposte nuove avviene sul client --- è l'unico posto dove può
 * avvenire, visto che il server non ha la Master Key.
 */
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
