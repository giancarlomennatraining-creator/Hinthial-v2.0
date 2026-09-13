"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { removeAvatar, updateAvatar } from "@/domain/profile/repository";
import { AvatarPickerCrop } from "@/components/ui/AvatarPickerCrop";

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
  const supabase = useRef(createClient()).current;
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  async function handleCropped(blob: Blob) {
    const { path, url } = await updateAvatar(supabase, userId, blob, avatarPath);
    setAvatarUrl(url);
    setAvatarPath(path);
  }

  async function handleRemove() {
    if (!avatarPath || !window.confirm("Rimuovere la foto profilo?")) return;
    await removeAvatar(supabase, userId, avatarPath);
    setAvatarUrl(null);
    setAvatarPath(null);
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Foto profilo</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Mostrata accanto al tuo nome nell&apos;app. In chiaro, non cifrata --- come nome e
          cognome.
        </p>
      </div>

      <AvatarPickerCrop
        currentAvatarUrl={avatarUrl}
        fallbackFirstName={firstName}
        fallbackLastName={lastName}
        fallbackSeed={userId}
        onCropped={handleCropped}
        onRemove={handleRemove}
      />
    </section>
  );
}
