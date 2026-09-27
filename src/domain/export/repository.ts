import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { utf8ToBytes } from "@/lib/crypto";
import { sanitizeFilename } from "@/lib/utils";
import { listCategories } from "@/domain/categories/repository";
import { listAssets } from "@/domain/assets/repository";
import { downloadDocument, listDocuments } from "@/domain/documents/repository";
import { listReminders } from "@/domain/reminders/repository";
import { listFriends } from "@/domain/friends/repository";
import { downloadCapsuleAttachment, listCapsules } from "@/domain/capsules/repository";
import type { ExportFile, ExportManifest, ExportResult } from "@/domain/export/types";

/**
 * FASE 9: export completo, decifrato client-side --- `manifest.json` + bytes di ogni documento/allegato. Un file non
 * scaricabile finisce con `exportedAs: null` invece di far fallire tutto l'export.
 */
export async function buildExport(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  profile: { firstName: string; lastName: string; email: string },
): Promise<ExportResult> {
  const [categories, assets, documents, reminders, friends, capsules] = await Promise.all([
    listCategories(supabase),
    listAssets(supabase, masterKey),
    listDocuments(supabase, masterKey),
    listReminders(supabase, masterKey),
    listFriends(supabase, masterKey),
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
        issuer: doc.issuer,
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
        relatedFriendIds: capsule.relatedFriends.map((c) => c.id),
        linkedDocumentIds: capsule.linkedDocuments.map((d) => d.id),
        createdAt: capsule.createdAt,
        attachments: attachmentEntries,
      };
    }),
  );

  const manifest: ExportManifest = {
    generatedAt: new Date().toISOString(),
    hinthialExportVersion: 2,
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
    friends: friends.map((friend) => ({
      id: friend.id,
      name: friend.name,
      email: friend.email,
      role: friend.role,
      status: friend.status,
      createdAt: friend.createdAt,
    })),
    capsules: capsuleEntries,
  };

  return {
    manifest,
    files: [...files, { path: "manifest.json", data: utf8ToBytes(JSON.stringify(manifest, null, 2)) }],
  };
}
