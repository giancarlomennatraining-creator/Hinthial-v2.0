import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { utf8ToBytes } from "@/lib/crypto";
import { sanitizeFilename } from "@/lib/utils";
import { listCategories } from "@/domain/categories/repository";
import { listAssets } from "@/domain/assets/repository";
import { downloadDocument, listDocuments } from "@/domain/documents/repository";
import { listReminders } from "@/domain/reminders/repository";
import { listTrustedContacts } from "@/domain/contacts/repository";
import { downloadCapsuleAttachment, listCapsules } from "@/domain/capsules/repository";
import type { ExportFile, ExportManifest, ExportResult } from "@/domain/export/types";

/**
 * Builds a full export of the current user's data: a `manifest.json`
 * with every entity's already-decrypted metadata, plus the decrypted
 * bytes of every document and capsule attachment --- everything the app
 * knows about the account, in one portable bundle (v. HINTHIAL_MVP.md,
 * FASE 9: "HINTHIAL non deve diventare una prigione dei dati
 * dell'utente"). Decryption happens entirely client-side with the
 * already-unlocked Master Key; nothing here touches the server beyond
 * reading the same ciphertext every other screen already reads.
 *
 * A document/attachment whose ciphertext can't be fetched (e.g. a
 * transient network error) is listed in the manifest with
 * `exportedAs: null` rather than failing the whole export --- the user
 * still gets everything else.
 */
export async function buildExport(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  profile: { firstName: string; lastName: string; email: string },
): Promise<ExportResult> {
  const [categories, assets, documents, reminders, trustedContacts, capsules] = await Promise.all([
    listCategories(supabase),
    listAssets(supabase, masterKey),
    listDocuments(supabase, masterKey),
    listReminders(supabase, masterKey),
    listTrustedContacts(supabase, masterKey),
    listCapsules(supabase, masterKey),
  ]);

  const files: ExportFile[] = [];

  const documentEntries = await Promise.all(
    documents.map(async (doc) => {
      let exportedAs: string | null = null;
      try {
        const { bytes } = await downloadDocument(supabase, masterKey, doc);
        exportedAs = `documenti/${doc.id}-${sanitizeFilename(doc.filename)}`;
        files.push({ path: exportedAs, data: bytes });
      } catch {
        exportedAs = null;
      }

      return {
        id: doc.id,
        filename: doc.filename,
        mimeType: doc.mimeType,
        size: doc.size,
        categoryId: doc.categoryId,
        relatedAssetId: doc.relatedAssetId,
        expiresAt: doc.expiresAt,
        notes: doc.notes,
        tags: doc.tags,
        createdAt: doc.createdAt,
        exportedAs,
      };
    }),
  );

  const capsuleEntries = await Promise.all(
    capsules.map(async (capsule) => {
      const attachmentEntries = await Promise.all(
        capsule.attachments.map(async (attachment) => {
          let exportedAs: string | null = null;
          try {
            const { bytes } = await downloadCapsuleAttachment(
              supabase,
              masterKey,
              ownerId,
              capsule.id,
              attachment,
            );
            exportedAs = `capsule/${capsule.id}/${attachment.id}-${sanitizeFilename(attachment.filename)}`;
            files.push({ path: exportedAs, data: bytes });
          } catch {
            exportedAs = null;
          }

          return {
            id: attachment.id,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.size,
            exportedAs,
          };
        }),
      );

      return {
        id: capsule.id,
        title: capsule.title,
        content: capsule.content,
        status: capsule.status,
        accessCondition: capsule.accessCondition,
        openAt: capsule.openAt,
        relatedContactIds: capsule.relatedContacts.map((c) => c.id),
        linkedDocumentIds: capsule.linkedDocuments.map((d) => d.id),
        createdAt: capsule.createdAt,
        attachments: attachmentEntries,
      };
    }),
  );

  const manifest: ExportManifest = {
    generatedAt: new Date().toISOString(),
    hinthialExportVersion: 1,
    profile,
    categories,
    assets: assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      categoryId: asset.categoryId,
      createdAt: asset.createdAt,
    })),
    documents: documentEntries,
    reminders: reminders.map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      dueAt: reminder.dueAt,
      completed: reminder.completed,
      relatedDocumentId: reminder.relatedDocumentId,
      relatedAssetId: reminder.relatedAssetId,
      createdAt: reminder.createdAt,
    })),
    trustedContacts: trustedContacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      role: contact.role,
      status: contact.status,
      createdAt: contact.createdAt,
    })),
    capsules: capsuleEntries,
  };

  return {
    manifest,
    files: [...files, { path: "manifest.json", data: utf8ToBytes(JSON.stringify(manifest, null, 2)) }],
  };
}
