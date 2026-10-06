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
import { logAuditEvent, type AuditEntityRef } from "@/lib/audit/log-event";
import { decryptStructuredFields, encryptStructuredFields } from "@/domain/documents/repository";
import { registerFieldVocabulary } from "@/domain/structured-fields/vocabulary";
import { createAsset, deleteAsset } from "@/domain/assets/repository";
import { createReminder, deleteReminder } from "@/domain/reminders/repository";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Proposal, ProposalKind, ProposalRejection } from "@/domain/proposals/types";

/**
 * FASE 19: le tre risposte a una proposta. Scadenza/categoria accettate finiscono in chiaro (lo erano già); l'emittente
 * si cifra come le note (testo libero, non un id/data). Il valore rifiutato è sempre cifrato, altrimenti il server
 * vedrebbe un dato che senza questa fase non esisterebbe.
 *
 * Il kind "field" (campi eterogenei aperti) condivide un unico blob cifrato con altri campi dello stesso documento
 * --- a differenza degli altri tre kind, non basta un overwrite diretto: serve leggere lo stato più recente dal
 * database prima di scrivere, altrimenti un campo aggiunto nel frattempo (es. da un'altra proposta accettata poco
 * prima) andrebbe perso. V. mergeStructuredField.
 */

/** Ciò che serve per rimettere le cose com'erano --- v. undoAcceptance. */
export interface AcceptedProposal {
  kind: ProposalKind;
  /** Solo per kind "field". */
  fieldKey?: string;
  /** Il valore che il campo aveva **prima**: null se era vuoto. */
  previousValue: string | null;
  /** Solo per kind "event": la scadenza creata, da eliminare se si annulla. */
  reminderId?: string;
  /** Solo per kind "asset" che crea un bene: il bene creato, da eliminare se si annulla. */
  createdAssetId?: string;
}

/** Un evento letto è un giorno, non un'ora: la scadenza si fissa alle 9 del mattino (fuso dell'utente), un orario ragionevole per un promemoria. */
function reminderDueAt(date: string): string {
  return new Date(`${date}T09:00:00`).toISOString();
}

/** null/vuoto in -> null out, come encryptOptionalText in documents/repository.ts. */
async function encryptIssuerValue(masterKey: CryptoKey, value: string | null): Promise<string | null> {
  if (!value?.trim()) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(value)));
}

/** Unione esplicita, non chiave calcolata --- TypeScript non verificherebbe una chiave dinamica, e qui un refuso scriverebbe nel campo sbagliato. */
type DocumentsTableUpdate = Database["public"]["Tables"]["documents"]["Update"];

/** Solo per i kind a colonna dedicata --- "field" ha il proprio percorso, v. mergeStructuredField. */
async function updateFor(
  masterKey: CryptoKey,
  kind: "expiry" | "category" | "issuer" | "asset",
  value: string | null,
): Promise<Pick<DocumentsTableUpdate, "expires_at" | "category_id" | "encrypted_issuer" | "related_asset_id">> {
  if (kind === "expiry") return { expires_at: value };
  if (kind === "asset") return { related_asset_id: value };
  if (kind === "category") return { category_id: value };
  return { encrypted_issuer: await encryptIssuerValue(masterKey, value) };
}

function currentValue(doc: DocumentListItem, kind: "expiry" | "category" | "issuer" | "asset"): string | null {
  if (kind === "expiry") return doc.expiresAt;
  if (kind === "asset") return doc.relatedAssetId;
  if (kind === "category") return doc.categoryId;
  return doc.issuer || null;
}

/**
 * Legge lo stato più recente di encrypted_structured_fields dal database (non un `doc` eventualmente stantio
 * chiuso in una closure di "Annulla"), applica una sola modifica alla chiave data, e ritorna sia l'update pronto
 * sia il valore che quella chiave aveva prima --- letto fresco per lo stesso motivo.
 */
async function mergeStructuredField(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
  fieldKey: string,
  value: string | null,
): Promise<{
  update: Pick<DocumentsTableUpdate, "encrypted_structured_fields">;
  previousValue: string | null;
}> {
  const { data, error } = await supabase
    .from("documents")
    .select("encrypted_structured_fields")
    .eq("id", documentId)
    .single();

  if (error || !data) {
    throw new Error(`Impossibile leggere i campi del documento: ${error?.message}`);
  }

  const current = await decryptStructuredFields(masterKey, data.encrypted_structured_fields);
  const previousValue = current[fieldKey] ?? null;

  const next = { ...current };
  if (value === null || !value.trim()) {
    delete next[fieldKey];
  } else {
    next[fieldKey] = value;
  }

  return {
    update: { encrypted_structured_fields: await encryptStructuredFields(masterKey, next) },
    previousValue,
  };
}

/** `value` è a parte, non preso dalla proposta: è lo stesso percorso di "modifica", accettare tal quale o corretto è la stessa operazione. */
export async function acceptProposal(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  doc: DocumentListItem,
  proposal: Proposal,
  value: string,
): Promise<AcceptedProposal> {
  if (proposal.kind === "event") {
    const title = proposal.eventTitle?.trim();
    if (!title) throw new Error("Proposta di evento senza titolo.");

    // Non tocca il documento: crea una scadenza in Scadenze, collegata ad esso.
    const reminderId = await createReminder(supabase, masterKey, ownerId, {
      title,
      dueAt: reminderDueAt(value),
      relatedDocumentId: doc.id,
      relatedAssetId: null,
    });
    await logAuditEvent(supabase, ownerId, "proposal_accepted", { proposalKind: "event" }, documentRef(doc.id));
    return { kind: "event", previousValue: null, reminderId };
  }

  if (proposal.kind === "field") {
    const fieldKey = proposal.fieldKey;
    if (!fieldKey) throw new Error("Proposta di campo senza chiave.");

    const { update, previousValue } = await mergeStructuredField(supabase, masterKey, doc.id, fieldKey, value);
    const { error } = await supabase.from("documents").update(update).eq("id", doc.id);
    if (error) {
      throw new Error(`Impossibile applicare la proposta: ${error.message}`);
    }

    // Prima accettazione di questa chiave: la registra nel vocabolario, così i prossimi documenti dello stesso
    // tipo la ritroveranno invece di una leggermente diversa (idempotente se già registrata).
    if (proposal.fieldLabel) {
      await registerFieldVocabulary(supabase, ownerId, fieldKey, proposal.fieldLabel);
    }

    await logAuditEvent(
      supabase,
      ownerId,
      "proposal_accepted",
      { proposalKind: "field", fieldKey },
      documentRef(doc.id),
    );
    return { kind: "field", fieldKey, previousValue };
  }

  if (proposal.kind === "asset" && proposal.createAsset) {
    const name = value.trim();
    if (!name) throw new Error("Proposta di bene senza nome.");

    // Il bene nasce nella categoria del documento, se ce l'ha: così il campo "Bene collegato" lo offre anche dopo.
    const assetId = await createAsset(supabase, masterKey, ownerId, { name, categoryId: doc.categoryId });
    const { error } = await supabase.from("documents").update({ related_asset_id: assetId }).eq("id", doc.id);
    if (error) {
      // Il documento non è stato collegato: il bene appena creato non deve restare orfano.
      await deleteAsset(supabase, ownerId, assetId).catch(() => undefined);
      throw new Error(`Impossibile applicare la proposta: ${error.message}`);
    }

    await logAuditEvent(supabase, ownerId, "proposal_accepted", { proposalKind: "asset" }, documentRef(doc.id));
    return { kind: "asset", previousValue: doc.relatedAssetId, createdAssetId: assetId };
  }

  const previousValue = currentValue(doc, proposal.kind);

  const { error } = await supabase
    .from("documents")
    .update(await updateFor(masterKey, proposal.kind, value))
    .eq("id", doc.id);

  if (error) {
    throw new Error(`Impossibile applicare la proposta: ${error.message}`);
  }

  // In Attività resta traccia del *tipo*, mai del valore: gli audit non devono contenere contenuti.
  await logAuditEvent(supabase, ownerId, "proposal_accepted", { proposalKind: proposal.kind }, documentRef(doc.id));

  return { kind: proposal.kind, previousValue };
}

/** Rimette il campo com'era prima di un'accettazione. */
export async function undoAcceptance(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  documentId: string,
  accepted: AcceptedProposal,
): Promise<void> {
  if (accepted.kind === "event") {
    if (!accepted.reminderId) throw new Error("Annullamento di un evento senza scadenza.");
    await deleteReminder(supabase, accepted.reminderId);
    await logAuditEvent(supabase, ownerId, "proposal_undone", { proposalKind: "event" }, documentRef(documentId));
    return;
  }

  if (accepted.kind === "field") {
    const fieldKey = accepted.fieldKey;
    if (!fieldKey) throw new Error("Annullamento di un campo senza chiave.");

    const { update } = await mergeStructuredField(supabase, masterKey, documentId, fieldKey, accepted.previousValue);
    const { error } = await supabase.from("documents").update(update).eq("id", documentId);
    if (error) {
      throw new Error(`Impossibile annullare: ${error.message}`);
    }
    await logAuditEvent(
      supabase,
      ownerId,
      "proposal_undone",
      { proposalKind: "field", fieldKey },
      documentRef(documentId),
    );
    return;
  }

  const { error } = await supabase
    .from("documents")
    .update(await updateFor(masterKey, accepted.kind, accepted.previousValue))
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile annullare: ${error.message}`);
  }

  // Un bene creato dalla proposta sparisce con lei: prima il documento è stato scollegato, poi si elimina.
  if (accepted.createdAssetId) await deleteAsset(supabase, ownerId, accepted.createdAssetId);

  await logAuditEvent(supabase, ownerId, "proposal_undone", { proposalKind: accepted.kind }, documentRef(documentId));
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
      field_key: proposal.fieldKey ?? null,
      encrypted_value: encryptedValue,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Impossibile registrare il rifiuto: ${error?.message}`);
  }

  await logAuditEvent(
    supabase,
    ownerId,
    "proposal_rejected",
    {
      proposalKind: proposal.kind,
      ...(proposal.fieldKey ? { fieldKey: proposal.fieldKey } : {}),
    },
    documentRef(documentId),
  );

  return data.id;
}

/** Cancella un rifiuto: la proposta torna a comparire. */
export async function undoRejection(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  rejectionId: string,
  /** Per la cronologia del documento: a quale documento e proposta si riferisce l'annullamento. */
  context?: { documentId: string; kind: ProposalKind; fieldKey?: string },
): Promise<void> {
  const { error } = await supabase.from("proposal_rejections").delete().eq("id", rejectionId);
  if (error) {
    throw new Error(`Impossibile annullare: ${error.message}`);
  }

  await logAuditEvent(
    supabase,
    ownerId,
    "proposal_undone",
    context
      ? {
          proposalKind: context.kind,
          ...(context.fieldKey ? { fieldKey: context.fieldKey } : {}),
        }
      : undefined,
    context ? documentRef(context.documentId) : undefined,
  );
}

function documentRef(id: string): AuditEntityRef {
  return { type: "document", id };
}

/** Rifiuti già espressi, decifrati --- il confronto con le proposte nuove avviene sul client, unico posto possibile. */
export async function listProposalRejections(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
): Promise<ProposalRejection[]> {
  const { data, error } = await supabase
    .from("proposal_rejections")
    .select("id, kind, field_key, encrypted_value")
    .eq("document_id", documentId);

  if (error) {
    throw new Error(`Impossibile caricare le decisioni precedenti: ${error.message}`);
  }

  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      kind: row.kind as ProposalKind,
      fieldKey: row.field_key ?? undefined,
      value: bytesToUtf8(await decryptBytes(masterKey, parseEnvelope(row.encrypted_value))),
    })),
  );
}
