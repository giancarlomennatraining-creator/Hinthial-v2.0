import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  bytesToUtf8,
  decryptBytes,
  deriveSharedKeyAsRecipient,
  deriveSharedKeyAsSender,
  encryptBytes,
  parseEnvelope,
  serializeEnvelope,
  unwrapPrivateKey,
  utf8ToBytes,
} from "@/lib/crypto";
import { normalizeReply, parseReplyPayload, type ReplyPayload } from "@/domain/capsules/replies";

/**
 * "Lascia un pensiero" (v. migrazione capsule_replies). Chi riceve una capsula aperta cifra il pensiero sul proprio
 * dispositivo per la chiave pubblica di chi l'ha lasciata (ECDH effimero, come per le capsule ma in senso inverso): il server
 * conserva solo un testo cifrato, e nemmeno chi l'ha scritto può rileggerlo. Solo il proprietario lo decifra.
 */

export interface CapsuleReply {
  id: string;
  capsuleId: string;
  authorName: string;
  message: string;
  /** ISO. */
  createdAt: string;
}

/** Il pensiero che l'utente ha già lasciato su una capsula, se c'è --- solo che esiste e da quando, mai il testo (non lo può decifrare). */
export async function getMyReply(
  supabase: SupabaseClient<Database>,
  capsuleId: string,
): Promise<{ id: string; createdAt: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Devi essere autenticato.");

  const { data, error } = await supabase
    .from("capsule_replies")
    .select("id, created_at")
    .eq("capsule_id", capsuleId)
    .eq("author_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Impossibile controllare il tuo pensiero: ${error.message}`);
  return data ? { id: data.id, createdAt: data.created_at } : null;
}

/** Cifra e invia il pensiero a chi ha lasciato la capsula. Un solo pensiero a testa per capsula. */
export async function leaveReply(
  supabase: SupabaseClient<Database>,
  capsuleId: string,
  ownerId: string,
  message: string,
): Promise<{ id: string; createdAt: string }> {
  const text = normalizeReply(message);
  if (text === null) throw new Error("Scrivi due righe (al massimo 600 caratteri).");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Devi essere autenticato.");

  const [keyResult, profileResult] = await Promise.all([
    supabase.rpc("get_capsule_owner_public_key", { p_capsule_id: capsuleId }),
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
  ]);
  if (keyResult.error || !keyResult.data) {
    throw new Error("Non riesco a raggiungere chi ha lasciato la capsula: la sua chiave non è ancora pronta.");
  }
  const authorName = `${profileResult.data?.first_name ?? ""} ${profileResult.data?.last_name ?? ""}`.trim() || "Un destinatario";

  const { sharedKey, ephemeralPublicKeyJwk } = await deriveSharedKeyAsSender(keyResult.data);
  const payload: ReplyPayload = { authorName, message: text, writtenAt: new Date().toISOString() };
  const encrypted = await encryptBytes(sharedKey, utf8ToBytes(JSON.stringify(payload)));

  const { data, error } = await supabase
    .from("capsule_replies")
    .insert({
      capsule_id: capsuleId,
      owner_id: ownerId,
      author_id: user.id,
      ephemeral_public_key: ephemeralPublicKeyJwk,
      encrypted_payload: serializeEnvelope(encrypted),
    })
    .select("id, created_at")
    .single();
  if (error || !data) {
    throw new Error(
      error?.code === "23505"
        ? "Hai già lasciato un pensiero su questa capsula."
        : `Impossibile inviare il pensiero: ${error?.message ?? "errore sconosciuto"}`,
    );
  }
  return { id: data.id, createdAt: data.created_at };
}

/** Toglie un pensiero: lo ritira chi l'ha scritto, o lo toglie dalla raccolta chi l'ha ricevuto. */
export async function deleteReply(supabase: SupabaseClient<Database>, replyId: string): Promise<void> {
  const { error } = await supabase.from("capsule_replies").delete().eq("id", replyId);
  if (error) throw new Error(`Impossibile togliere il pensiero: ${error.message}`);
}

/** I pensieri ricevuti sulle proprie capsule, decifrati con la propria chiave privata. Uno che non si decifra viene saltato, non rompe l'elenco. */
export async function listReceivedReplies(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<CapsuleReply[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Devi essere autenticato.");

  const { data: rows, error } = await supabase
    .from("capsule_replies")
    .select("id, capsule_id, ephemeral_public_key, encrypted_payload, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Impossibile leggere i pensieri ricevuti: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const { data: setup, error: setupError } = await supabase
    .from("encryption_setup")
    .select("wrapped_private_key")
    .eq("owner_id", user.id)
    .single();
  if (setupError || !setup?.wrapped_private_key) return [];
  const privateKey = await unwrapPrivateKey(masterKey, parseEnvelope(setup.wrapped_private_key));

  const replies: CapsuleReply[] = [];
  for (const row of rows) {
    try {
      const sharedKey = await deriveSharedKeyAsRecipient(privateKey, row.ephemeral_public_key);
      const plaintext = await decryptBytes(sharedKey, parseEnvelope(row.encrypted_payload));
      const payload = parseReplyPayload(JSON.parse(bytesToUtf8(plaintext)));
      if (payload) {
        replies.push({
          id: row.id,
          capsuleId: row.capsule_id,
          authorName: payload.authorName,
          message: payload.message,
          createdAt: row.created_at,
        });
      }
    } catch {
      // Un pensiero che non si decifra non deve impedire di leggere gli altri.
    }
  }
  return replies;
}
