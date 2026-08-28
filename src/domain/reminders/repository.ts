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
import type { ReminderInput, ReminderListItem } from "@/domain/reminders/types";

const REMINDER_COLUMNS =
  "id, encrypted_title, due_at, completed, related_document_id, created_at, documents(encrypted_filename)";

type ReminderRow = {
  id: string;
  encrypted_title: string;
  due_at: string;
  completed: boolean;
  related_document_id: string | null;
  created_at: string;
  documents: { encrypted_filename: string } | { encrypted_filename: string }[] | null;
};

function relatedDocument(row: ReminderRow): { encrypted_filename: string } | null {
  if (!row.documents) return null;
  return Array.isArray(row.documents) ? (row.documents[0] ?? null) : row.documents;
}

async function toReminderListItem(
  masterKey: CryptoKey,
  row: ReminderRow,
): Promise<ReminderListItem> {
  const titleBytes = await decryptBytes(masterKey, parseEnvelope(row.encrypted_title));
  const doc = relatedDocument(row);
  const relatedDocumentFilename = doc
    ? bytesToUtf8(await decryptBytes(masterKey, parseEnvelope(doc.encrypted_filename)))
    : null;

  return {
    id: row.id,
    title: bytesToUtf8(titleBytes),
    dueAt: row.due_at,
    completed: row.completed,
    relatedDocumentId: row.related_document_id,
    relatedDocumentFilename,
    createdAt: row.created_at,
  };
}

/**
 * Lists the current user's reminders (soonest due date first),
 * decrypting the title --- and the related document's filename, if
 * any --- client-side with the Master Key.
 */
export async function listReminders(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<ReminderListItem[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select(REMINDER_COLUMNS)
    .order("due_at", { ascending: true });

  if (error) {
    throw new Error(`Impossibile caricare le scadenze: ${error.message}`);
  }

  return Promise.all((data ?? []).map((row) => toReminderListItem(masterKey, row as ReminderRow)));
}

export async function createReminder(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  input: ReminderInput,
): Promise<void> {
  const encryptedTitle = await encryptBytes(masterKey, utf8ToBytes(input.title));

  const { error } = await supabase.from("reminders").insert({
    owner_id: ownerId,
    encrypted_title: serializeEnvelope(encryptedTitle),
    due_at: input.dueAt,
    related_document_id: input.relatedDocumentId,
  });

  if (error) {
    throw new Error(`Impossibile creare la scadenza: ${error.message}`);
  }
}

export async function setReminderCompleted(
  supabase: SupabaseClient<Database>,
  reminderId: string,
  completed: boolean,
): Promise<void> {
  const { error } = await supabase.from("reminders").update({ completed }).eq("id", reminderId);

  if (error) {
    throw new Error(`Impossibile aggiornare la scadenza: ${error.message}`);
  }
}

export async function deleteReminder(
  supabase: SupabaseClient<Database>,
  reminderId: string,
): Promise<void> {
  const { error } = await supabase.from("reminders").delete().eq("id", reminderId);

  if (error) {
    throw new Error(`Impossibile eliminare la scadenza: ${error.message}`);
  }
}
