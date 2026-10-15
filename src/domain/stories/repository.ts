import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createCategory, listCategories } from "@/domain/categories/repository";
import {
  createTextNote,
  downloadDocument,
  listDocumentSummaries,
  updateTextNoteContent,
  uploadDocument,
} from "@/domain/documents/repository";
import type { DocumentSummary } from "@/domain/documents/types";
import { STORIES_CATEGORY } from "@/domain/stories/questions";
import { NOTE_MIME_TYPE } from "@/lib/content-kind";
import { bytesToUtf8 } from "@/lib/crypto";

/**
 * I racconti vivono in Archivio come note nella categoria "Racconti": nessuna tabella a parte, si cercano come le altre
 * note e "Fallo arrivare a…" funziona senza altro. Il titolo della nota è la domanda, il corpo la risposta (più le
 * eventuali domande di approfondimento). Un racconto a voce è un file audio nella stessa categoria, con la domanda come
 * nome: cifrato come ogni altro contenuto, senza trascrizione. Qui sta solo il collegamento tra le due cose.
 */

export interface Story {
  id: string;
  /** La domanda (il titolo della nota). */
  question: string;
  createdAt: string;
  /** Registrato a voce (un file audio) invece che scritto (una nota). */
  voice: boolean;
  doc: DocumentSummary;
}

/** L'id della categoria "Racconti", creandola la prima volta. */
export async function ensureStoriesCategory(
  supabase: SupabaseClient<Database>,
  ownerId: string,
): Promise<string> {
  const categories = await listCategories(supabase);
  const found = categories.find((c) => c.name.trim().toLowerCase() === STORIES_CATEGORY.name.toLowerCase());
  if (found) return found.id;
  return createCategory(supabase, ownerId, { name: STORIES_CATEGORY.name, icon: STORIES_CATEGORY.icon });
}

/** I racconti scritti finora, dal più recente. Senza la categoria (mai creata) non ce n'è nessuno. */
export async function listStories(supabase: SupabaseClient<Database>, masterKey: CryptoKey): Promise<Story[]> {
  const [categories, documents] = await Promise.all([listCategories(supabase), listDocumentSummaries(supabase, masterKey)]);
  const category = categories.find((c) => c.name.trim().toLowerCase() === STORIES_CATEGORY.name.toLowerCase());
  if (!category) return [];

  return documents
    .filter((d) => d.categoryId === category.id && (d.mimeType === NOTE_MIME_TYPE || d.mimeType.startsWith("audio/")))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((doc) => ({
      id: doc.id,
      question: doc.filename,
      createdAt: doc.createdAt,
      voice: doc.mimeType.startsWith("audio/"),
      doc,
    }));
}

/** Salva una risposta come nota nella categoria "Racconti"; restituisce l'id della nota. */
export async function saveStory(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  input: { question: string; answer: string },
): Promise<string> {
  const categoryId = await ensureStoriesCategory(supabase, ownerId);
  return createTextNote(
    supabase,
    masterKey,
    ownerId,
    { title: input.question, body: input.answer.trim() },
    { categoryId, relatedAssetId: null, dossierIds: [], expiresAt: null, notes: "", issuer: "" },
  );
}

/** Salva una risposta registrata a voce come file audio nella categoria "Racconti"; restituisce l'id del contenuto. */
export async function saveVoiceStory(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  input: { question: string; recording: File },
): Promise<string> {
  const categoryId = await ensureStoriesCategory(supabase, ownerId);
  return uploadDocument(
    supabase,
    masterKey,
    ownerId,
    input.recording,
    { categoryId, relatedAssetId: null, dossierIds: [], expiresAt: null, notes: "", issuer: "" },
    // Nessuna lettura del contenuto: un audio non ha testo da estrarre, e non si trascrive.
    { title: input.question, extraction: { text: null, attempted: false } },
  );
}

/** Decifra un racconto a voce per riascoltarlo: un Blob da dare a un elemento <audio>. */
export async function loadVoiceStory(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  story: Pick<Story, "doc">,
): Promise<Blob> {
  const { bytes, mimeType } = await downloadDocument(supabase, masterKey, story.doc);
  return new Blob([bytes as BlobPart], { type: mimeType });
}

/** Il corpo di un racconto con una domanda di approfondimento e la sua risposta in fondo. */
export function withFollowUp(body: string, followUpQuestion: string, followUpAnswer: string): string {
  return `${body.trimEnd()}\n\n${followUpQuestion.trim()}\n${followUpAnswer.trim()}`;
}

/** Aggiunge una domanda di approfondimento e la sua risposta a un racconto già salvato. */
export async function appendFollowUp(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  story: Pick<Story, "id" | "question" | "doc">,
  followUp: { question: string; answer: string },
): Promise<void> {
  const { bytes } = await downloadDocument(supabase, masterKey, story.doc);
  const body = withFollowUp(bytesToUtf8(bytes), followUp.question, followUp.answer);
  await updateTextNoteContent(supabase, masterKey, ownerId, story.doc, { title: story.question, body });
}
