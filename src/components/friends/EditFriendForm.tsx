"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFriendNameFields } from "@/components/friends/useFriendNameFields";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { listFriends, removeFriendAvatar, updateFriend, updateFriendAvatar } from "@/domain/friends/repository";
import { inviteFriendToHinthial } from "@/lib/friends/actions";
import { AvatarPickerCrop } from "@/components/ui/AvatarPickerCrop";
import type { FriendListItem } from "@/domain/friends/types";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_FIELD } from "@/components/ui/styles";

/** Pagina di modifica di un amico. Conferma via `?updated=1` nell'URL, mai il nome in chiaro. Nessun elenco per id lato repository: si carica l'intero elenco già decifrato e si cerca l'id. */
export function EditFriendForm({ masterKey, friendId }: { masterKey: CryptoKey; friendId: string }) {
  const supabase = useSupabase();
  const router = useRouter();

  const [friend, setFriend] = useState<FriendListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [invite, setInvite] = useState(false);

  // Campi controllati, seminati una sola volta al primo caricamento di `friend`, non ad ogni refresh.
  const [hydrated, setHydrated] = useState(false);
  const { firstName, lastName, displayName, fill, handleFirstNameChange, handleLastNameChange, handleDisplayNameChange } =
    useFriendNameFields();
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const friends = await listFriends(supabase, masterKey);
      setFriend(friends.find((c) => c.id === friendId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare l'amico.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey, friendId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (hydrated || !friend) return;
    // Idratazione una tantum dal dato appena arrivato da refresh() (fetch asincrono, non stato derivato da props/state).
    fill(friend);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvatarPath(friend.avatarPath);
    setAvatarUrl(friend.avatarUrl);
    setHydrated(true);
  }, [friend, hydrated, fill]);

  async function handleAvatarCropped(blob: Blob) {
    setAvatarBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      const { path, url } = await updateFriendAvatar(supabase, user.id, friendId, blob, avatarPath);
      setAvatarPath(path);
      setAvatarUrl(url);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    if (!avatarPath || !window.confirm("Rimuovere la foto di questo amico?")) return;
    setAvatarBusy(true);
    try {
      await removeFriendAvatar(supabase, friendId, avatarPath);
      setAvatarPath(null);
      setAvatarUrl(null);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    // Il form è renderizzato solo quando `friend` non è null: questo handler scatta solo a quel punto.
    if (!friend) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim();
    const name = displayName.trim();

    if (!name || !email || !role) {
      setError("Compila nome visualizzato, email e ruolo.");
      return;
    }

    // Il collegamento a un account Hinthial è legato a QUESTA email: se cambia va azzerato, altrimenti badge e foto reale resterebbero agganciati all'account sbagliato.
    const emailChanged = email.toLowerCase() !== friend.email.trim().toLowerCase();

    setSaving(true);
    try {
      await updateFriend(supabase, masterKey, friendId, { name, email, firstName, lastName, role }, emailChanged);

      // Un invito non riuscito non deve impedire il salvataggio: si segnala con un parametro a parte, non un errore.
      let inviteFailed = false;
      if (invite) {
        try {
          await inviteFriendToHinthial(email);
        } catch {
          inviteFailed = true;
        }
      }

      router.push(`/friends?updated=1${inviteFailed ? "&inviteFailed=1" : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare l'amico.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/friends"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna agli amici
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand">
          Modifica amico
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : !friend ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Amico non trovato.
        </p>
      ) : (
        <>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
            <p className="mb-3 text-xs font-medium text-zinc-600 dark:text-zinc-400">Foto</p>
            <AvatarPickerCrop
              currentAvatarUrl={avatarUrl}
              fallbackFirstName={firstName}
              fallbackLastName={lastName}
              fallbackSeed={friendId}
              busy={avatarBusy}
              onCropped={handleAvatarCropped}
              onRemove={avatarPath ? handleAvatarRemove : undefined}
            />
          </div>

          <form
            onSubmit={handleSave}
            className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
              <label htmlFor="firstName" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Nome
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={firstName}
                onChange={handleFirstNameChange}
                className={INPUT_FIELD}
              />
            </div>

            <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
              <label htmlFor="lastName" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Cognome
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={lastName}
                onChange={handleLastNameChange}
                className={INPUT_FIELD}
              />
            </div>

            <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
              <label htmlFor="name" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Nome visualizzato
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={displayName}
                onChange={handleDisplayNameChange}
                className={INPUT_FIELD}
              />
            </div>

            <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
              <label htmlFor="email" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={friend.email}
                className={INPUT_FIELD}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="role" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Ruolo
              </label>
              <input
                id="role"
                name="role"
                type="text"
                required
                defaultValue={friend.role}
                className={INPUT_FIELD}
              />
            </div>

            <label className="flex w-full items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={invite}
                onChange={(e) => setInvite(e.target.checked)}
              />
              Invita questo amico su Hinthial
            </label>

            {error ? (
              <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className={`${BTN_PRIMARY} disabled:opacity-50`}
            >
              {saving ? "Salvataggio…" : "Salva modifiche"}
            </button>
            <Link
              href="/friends"
              className={BTN_SECONDARY}
            >
              Annulla
            </Link>
          </form>
        </>
      )}
    </div>
  );
}
