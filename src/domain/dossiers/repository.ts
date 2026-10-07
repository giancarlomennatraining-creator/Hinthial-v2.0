import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  encryptBytes,
  decryptBytes,
  parseEnvelope,
  serializeEnvelope,
  utf8ToBytes,
  bytesToUtf8,
} from "@/lib/crypto";
import { logAuditEvent, logAuditEventForCurrentUser } from "@/lib/audit/log-event";
import { removeDossierShareFiles } from "@/lib/storage/dossier-shares-bucket";
import type { DossierInput, DossierListItem, DossierStatus, DossierSummary } from "@/domain/dossiers/types";
import { parseStoredPhases, serializePhases, type DossierPhases } from "@/domain/dossiers/phases";
import {
  MAX_PERSON_NAME_LENGTH,
  MAX_PERSON_ROLE_LENGTH,
  MAX_STEP_LENGTH,
  parsePersonData,
  parseStepData,
  type DossierPerson,
  type DossierStep,
} from "@/domain/dossiers/items";
import type { ExpectedItem } from "@/domain/dossiers/expected";

const DOSSIER_COLUMNS =
  "id, encrypted_title, encrypted_description, encrypted_phases, encrypted_summary, status, created_at, closed_at";

type DossierRow = {
  id: string;
  encrypted_title: string;
  encrypted_description: string | null;
  encrypted_phases: string | null;
  encrypted_summary: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
};

/** null/empty in -> null out --- v. domain/documents/repository.ts, encryptOptionalText. */
async function encryptOptionalText(masterKey: CryptoKey, text: string): Promise<string | null> {
  if (!text.trim()) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(text)));
}

async function decryptOptionalText(masterKey: CryptoKey, serialized: string | null): Promise<string> {
  if (!serialized) return "";
  const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
  return bytesToUtf8(bytes);
}

/** Un JSON cifrato mai scritto (null) o guasto vale "niente": fasi e riassunto non devono mai bloccare l'apertura di un fascicolo. */
async function decryptOptionalJson<T>(masterKey: CryptoKey, serialized: string | null, parse: (json: string) => T | null): Promise<T | null> {
  if (!serialized) return null;
  try {
    return parse(await decryptOptionalText(masterKey, serialized));
  } catch {
    return null;
  }
}

function parseStoredSummary(json: string): DossierSummary | null {
  try {
    const value: unknown = JSON.parse(json);
    if (!value || typeof value !== "object") return null;
    const { text, generatedAt, documentCount } = value as Record<string, unknown>;
    if (typeof text !== "string" || !text.trim() || typeof generatedAt !== "string") return null;
    const readableCount = (value as { readableCount?: unknown }).readableCount;
    return {
      text,
      generatedAt,
      documentCount: typeof documentCount === "number" ? documentCount : 0,
      ...(typeof readableCount === "number" ? { readableCount } : {}),
    };
  } catch {
    return null;
  }
}

async function toDossierListItem(masterKey: CryptoKey, row: DossierRow): Promise<DossierListItem> {
  const [titleBytes, description, phases, summary] = await Promise.all([
    decryptBytes(masterKey, parseEnvelope(row.encrypted_title)),
    decryptOptionalText(masterKey, row.encrypted_description),
    decryptOptionalJson(masterKey, row.encrypted_phases, parseStoredPhases),
    decryptOptionalJson(masterKey, row.encrypted_summary, parseStoredSummary),
  ]);

  return {
    id: row.id,
    title: bytesToUtf8(titleBytes),
    description,
    // Colonna `text` con check lato DB, non un enum Postgres --- il cast è sicuro, il vincolo lo garantisce.
    status: row.status as DossierStatus,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    phases,
    summary,
  };
}

/** Lists the current user's dossiers (most recent first), decrypting title/description client-side. */
export async function listDossiers(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<DossierListItem[]> {
  const { data, error } = await supabase
    .from("dossiers")
    .select(DOSSIER_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare i fascicoli: ${error.message}`);
  }

  return Promise.all((data ?? []).map((row) => toDossierListItem(masterKey, row)));
}

/** Returns the new dossier's id. */
export async function createDossier(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  input: DossierInput,
): Promise<string> {
  const id = crypto.randomUUID();
  const [encryptedTitle, encryptedDescription] = await Promise.all([
    encryptBytes(masterKey, utf8ToBytes(input.title)),
    encryptOptionalText(masterKey, input.description),
  ]);

  const { error } = await supabase.from("dossiers").insert({
    id,
    owner_id: ownerId,
    encrypted_title: serializeEnvelope(encryptedTitle),
    encrypted_description: encryptedDescription,
  });

  if (error) {
    throw new Error(`Impossibile creare il fascicolo: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "dossier_created", undefined, { type: "dossier", id });

  return id;
}

/** Updates title/description --- never the status, v. setDossierStatus. */
export async function updateDossier(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  dossierId: string,
  input: DossierInput,
): Promise<void> {
  const [encryptedTitle, encryptedDescription] = await Promise.all([
    encryptBytes(masterKey, utf8ToBytes(input.title)),
    encryptOptionalText(masterKey, input.description),
  ]);

  const { error } = await supabase
    .from("dossiers")
    .update({
      encrypted_title: serializeEnvelope(encryptedTitle),
      encrypted_description: encryptedDescription,
    })
    .eq("id", dossierId);

  if (error) {
    throw new Error(`Impossibile aggiornare il fascicolo: ${error.message}`);
  }

  await logAuditEventForCurrentUser(supabase, "dossier_updated", undefined, { type: "dossier", id: dossierId });
}

/** Azione a sé, un solo clic (stesso schema di setReminderCompleted) --- `closed_at` si azzera riaprendo. */
export async function setDossierStatus(
  supabase: SupabaseClient<Database>,
  dossierId: string,
  status: DossierStatus,
): Promise<void> {
  const { error } = await supabase
    .from("dossiers")
    .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null })
    .eq("id", dossierId);

  if (error) {
    throw new Error(`Impossibile aggiornare lo stato del fascicolo: ${error.message}`);
  }
}

/** I documenti collegati non vengono toccati, solo scollegati (ON DELETE CASCADE sulla riga di collegamento) --- come beni e categorie. */
export async function deleteDossier(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  dossierId: string,
): Promise<void> {
  // I link di condivisione spariscono con il fascicolo, ma le copie cifrate dei documenti in Storage vanno tolte a parte.
  await removeDossierShareFiles(supabase, ownerId, dossierId);

  // Il titolo è già cifrato nella riga: lo si copia nell'evento, per riconoscere il fascicolo dopo l'eliminazione.
  const { data: titleRow } = await supabase.from("dossiers").select("encrypted_title").eq("id", dossierId).maybeSingle();

  const { error } = await supabase.from("dossiers").delete().eq("id", dossierId);

  if (error) {
    throw new Error(`Impossibile eliminare il fascicolo: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "dossier_deleted", undefined, {
    type: "dossier",
    id: dossierId,
    encryptedLabel: titleRow?.encrypted_title,
  });
}

/** FASE 20c: tabella ponte `document_dossiers` letta in un colpo solo per un insieme di documenti, non una query a testa. Id in chiaro, nessuna decifratura. */
export async function listDossierIdsForDocuments(
  supabase: SupabaseClient<Database>,
  documentIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (documentIds.length === 0) return map;

  const { data, error } = await supabase
    .from("document_dossiers")
    .select("document_id, dossier_id")
    .in("document_id", documentIds);

  if (error) {
    throw new Error(`Impossibile caricare i collegamenti ai fascicoli: ${error.message}`);
  }

  for (const row of data ?? []) {
    const existing = map.get(row.document_id);
    if (existing) existing.push(row.dossier_id);
    else map.set(row.document_id, [row.dossier_id]);
  }

  return map;
}

/**
 * Tutti i collegamenti documento-fascicolo dell'utente (le regole di accesso mostrano solo i suoi), per leggerli in
 * parallelo all'elenco dei documenti invece che dopo, con un viaggio di rete in più: con `in(ids)` bisognava aspettare
 * di conoscere gli id.
 */
export async function listAllDossierLinks(supabase: SupabaseClient<Database>): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const { data, error } = await supabase.from("document_dossiers").select("document_id, dossier_id");
  if (error) {
    throw new Error(`Impossibile caricare i collegamenti ai fascicoli: ${error.message}`);
  }
  for (const row of data ?? []) {
    const existing = map.get(row.document_id);
    if (existing) existing.push(row.dossier_id);
    else map.set(row.document_id, [row.dossier_id]);
  }
  return map;
}

/** Cancella e reinserisce l'intero insieme invece di calcolare un diff --- pochi fascicoli a documento, non vale la complessità. */
export async function replaceDocumentDossierLinks(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  documentId: string,
  dossierIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("document_dossiers")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    throw new Error(`Impossibile aggiornare i fascicoli collegati: ${deleteError.message}`);
  }

  if (dossierIds.length === 0) return;

  const { error: insertError } = await supabase.from("document_dossiers").insert(
    dossierIds.map((dossierId) => ({
      document_id: documentId,
      dossier_id: dossierId,
      owner_id: ownerId,
    })),
  );

  if (insertError) {
    throw new Error(`Impossibile aggiornare i fascicoli collegati: ${insertError.message}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Documenti attesi (v. domain/dossiers/expected.ts): l'etichetta è cifrata, la spunta e l'ordine no.
// ---------------------------------------------------------------------------------------------------------------

/** Dal più vecchio al più nuovo: l'ordine in cui l'utente li ha scritti. */
export async function listExpectedItems(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  dossierId: string,
): Promise<ExpectedItem[]> {
  const { data, error } = await supabase
    .from("dossier_expected_items")
    .select("id, encrypted_label, done")
    .eq("dossier_id", dossierId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Impossibile caricare i documenti attesi: ${error.message}`);
  }

  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      label: bytesToUtf8(await decryptBytes(masterKey, parseEnvelope(row.encrypted_label))),
      done: row.done,
    })),
  );
}

export async function addExpectedItem(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  dossierId: string,
  label: string,
): Promise<void> {
  const encrypted = await encryptBytes(masterKey, utf8ToBytes(label.trim()));
  const { error } = await supabase.from("dossier_expected_items").insert({
    owner_id: ownerId,
    dossier_id: dossierId,
    encrypted_label: serializeEnvelope(encrypted),
  });

  if (error) {
    throw new Error(`Impossibile aggiungere il documento atteso: ${error.message}`);
  }
}

export async function setExpectedItemDone(
  supabase: SupabaseClient<Database>,
  itemId: string,
  done: boolean,
): Promise<void> {
  const { error } = await supabase.from("dossier_expected_items").update({ done }).eq("id", itemId);

  if (error) {
    throw new Error(`Impossibile aggiornare il documento atteso: ${error.message}`);
  }
}

export async function deleteExpectedItem(supabase: SupabaseClient<Database>, itemId: string): Promise<void> {
  const { error } = await supabase.from("dossier_expected_items").delete().eq("id", itemId);

  if (error) {
    throw new Error(`Impossibile eliminare il documento atteso: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Fasi, riassunto, prossimi passi e persone (v. migrazione dossier_phases_items_summary): tutto cifrato sul dispositivo.
// ---------------------------------------------------------------------------------------------------------------

/** `null` toglie le fasi. */
export async function setDossierPhases(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  dossierId: string,
  phases: DossierPhases | null,
): Promise<void> {
  const encrypted = phases ? await encryptOptionalText(masterKey, serializePhases(phases)) : null;
  const { error } = await supabase.from("dossiers").update({ encrypted_phases: encrypted }).eq("id", dossierId);

  if (error) {
    throw new Error(`Impossibile salvare le fasi: ${error.message}`);
  }
}

export async function setDossierSummary(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  dossierId: string,
  summary: DossierSummary | null,
): Promise<void> {
  const encrypted = summary ? await encryptOptionalText(masterKey, JSON.stringify(summary)) : null;
  const { error } = await supabase.from("dossiers").update({ encrypted_summary: encrypted }).eq("id", dossierId);

  if (error) {
    throw new Error(`Impossibile salvare il riassunto: ${error.message}`);
  }
}

export interface DossierItems {
  steps: DossierStep[];
  people: DossierPerson[];
}

/** Passi e persone di un fascicolo, o di tutti se `dossierId` manca (per l'elenco). Una riga illeggibile si salta. */
export async function listDossierItems(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  dossierId?: string,
): Promise<DossierItems> {
  let query = supabase
    .from("dossier_items")
    .select("id, dossier_id, kind, encrypted_data, due_on, done")
    .order("created_at", { ascending: true });
  if (dossierId) query = query.eq("dossier_id", dossierId);
  const { data, error } = await query;

  if (error) {
    throw new Error(`Impossibile caricare passi e persone: ${error.message}`);
  }

  const items: DossierItems = { steps: [], people: [] };
  await Promise.all(
    (data ?? []).map(async (row, index) => {
      try {
        const json = await decryptOptionalText(masterKey, row.encrypted_data);
        if (row.kind === "step") {
          const text = parseStepData(json);
          if (text) items.steps[index] = { id: row.id, dossierId: row.dossier_id, text, dueOn: row.due_on, done: row.done };
        } else if (row.kind === "person") {
          const person = parsePersonData(json);
          if (person) items.people[index] = { id: row.id, dossierId: row.dossier_id, ...person };
        }
      } catch {
        // Una riga che non si decifra non deve nascondere le altre.
      }
    }),
  );
  // Gli indici tengono l'ordine di creazione; i buchi delle righe saltate si tolgono qui.
  return { steps: items.steps.filter(Boolean), people: items.people.filter(Boolean) };
}

export async function addDossierStep(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  dossierId: string,
  input: { text: string; dueOn: string | null },
): Promise<void> {
  const encrypted = await encryptOptionalText(masterKey, JSON.stringify({ text: input.text.trim().slice(0, MAX_STEP_LENGTH) }));
  const { error } = await supabase.from("dossier_items").insert({
    owner_id: ownerId,
    dossier_id: dossierId,
    kind: "step",
    encrypted_data: encrypted as string,
    due_on: input.dueOn,
  });

  if (error) {
    throw new Error(`Impossibile aggiungere il passo: ${error.message}`);
  }
}

export async function addDossierPerson(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  dossierId: string,
  input: { name: string; role: string },
): Promise<void> {
  const data = {
    name: input.name.trim().slice(0, MAX_PERSON_NAME_LENGTH),
    role: input.role.trim().slice(0, MAX_PERSON_ROLE_LENGTH),
  };
  const encrypted = await encryptOptionalText(masterKey, JSON.stringify(data));
  const { error } = await supabase.from("dossier_items").insert({
    owner_id: ownerId,
    dossier_id: dossierId,
    kind: "person",
    encrypted_data: encrypted as string,
  });

  if (error) {
    throw new Error(`Impossibile aggiungere la persona: ${error.message}`);
  }
}

export async function setDossierStepDone(supabase: SupabaseClient<Database>, itemId: string, done: boolean): Promise<void> {
  const { error } = await supabase.from("dossier_items").update({ done }).eq("id", itemId);

  if (error) {
    throw new Error(`Impossibile aggiornare il passo: ${error.message}`);
  }
}

export async function deleteDossierItem(supabase: SupabaseClient<Database>, itemId: string): Promise<void> {
  const { error } = await supabase.from("dossier_items").delete().eq("id", itemId);

  if (error) {
    throw new Error(`Impossibile eliminare la voce: ${error.message}`);
  }
}
