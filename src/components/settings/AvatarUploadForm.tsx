"use client";

import { useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { removeAvatar, updateAvatar } from "@/domain/profile/repository";
import { AvatarPickerCrop } from "@/components/ui/AvatarPickerCrop";
import { useConfirm } from "@/components/ui/ConfirmProvider";

/**
 * Impostazioni -> Informazioni utente -> Foto profilo. In chiaro, non
 * cifrata (v. domain/profile/repository.ts) --- come nome e cognome. Il
 * ritaglio (canvas, drag, zoom, "Scatta foto"/"Carica foto") vive in
 * AvatarPickerCrop, riusato anche per la foto di un amico (v.
 * FriendAvatarField) --- qui restano solo il salvataggio/la rimozione
 * verso il profilo.
 */
export function AvatarUploadForm({
  userId,
  firstName,
  lastName,
  avatarPath: initialAvatarPath,
  avatarUrl: initialAvatarUrl,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
}) {
  const supabase = useSupabase();
  const confirm = useConfirm();
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  async function handleCropped(blob: Blob) {
    const { path, url } = await updateAvatar(supabase, userId, blob, avatarPath);
    setAvatarUrl(url);
    setAvatarPath(path);
  }

  async function handleRemove() {
    if (!avatarPath) return;
    if (!(await confirm({ message: "Rimuovere la foto profilo?", confirmLabel: "Rimuovi la foto", danger: true }))) return;
    await removeAvatar(supabase, userId, avatarPath);
    setAvatarUrl(null);
    setAvatarPath(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <AvatarPickerCrop
        currentAvatarUrl={avatarUrl}
        fallbackFirstName={firstName}
        fallbackLastName={lastName}
        fallbackSeed={userId}
        onCropped={handleCropped}
        onRemove={handleRemove}
      />
    </div>
  );
}
