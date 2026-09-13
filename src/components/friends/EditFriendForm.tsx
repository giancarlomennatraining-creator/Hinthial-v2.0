"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { listFriends, removeFriendAvatar, updateFriend, updateFriendAvatar } from "@/domain/friends/repository";
import { inviteFriendToHinthial } from "@/lib/friends/actions";
import { AvatarPickerCrop } from "@/components/ui/AvatarPickerCrop";
import type { FriendListItem } from "@/domain/friends/types";

/**
 * Pagina dedicata alla modifica di un amico --- prima era un form
 * inline nella riga di FriendsPanel, ora una pagina a sé come la
 * creazione (stesso pattern di conferma via `?updated=1` nell'URL, mai
 * il nome in chiaro). Nessun elenco per id già pronto lato repository
 * (come per beni/capsule): si carica l'intero elenco già decifrato e si
 * cerca l'id, esattamente come faceva il pannello prima.
 */
export function EditFriendForm({ masterKey, friendId }: { masterKey: CryptoKey; friendId: string }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [friend, setFriend] = useState<FriendListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [invite, setInvite] = useState(false);

  // Campi controllati (per l'auto-sincronizzazione di "Nome visualizzato",
  // v. sotto) --- seminati una sola volta al primo caricamento di
  // `friend` (v. effetto sotto), non ad ogni refresh.
  const [hydrated, setHydrated] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displayNameEdited, setDisplayNameEdited] = useState(false);
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
    // Idratazione una tantum dal dato appena arrivato da refresh() (fetch
    // asincrono, non uno stato derivato da altre props/state React) ---
    // stesso caso già accettato altrove (v. useMediaQuery.ts).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFirstName(friend.firstName);
    setLastName(friend.lastName);
    setDisplayName(friend.name);
    // Se il nome visualizzato attuale coincide già con "nome cognome"
    // (o l'amico non ha ancora nome/cognome impostati), lo si considera
    // ancora "automatico" --- continuerà a seguirli finché non viene
    // toccato direttamente. Altrimenti (già personalizzato, o un amico
    // creato prima che nome/cognome esistessero) resta quello scelto,
    // senza sovrascriverlo modificando nome/cognome.
    setDisplayNameEdited(friend.name !== `${friend.firstName} ${friend.lastName}`.trim());
    setAvatarPath(friend.avatarPath);
    setAvatarUrl(friend.avatarUrl);
    setHydrated(true);
  }, [friend, hydrated]);

  function handleFirstNameChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setFirstName(value);
    if (!displayNameEdited) setDisplayName(`${value} ${lastName}`.trim());
  }

  function handleLastNameChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setLastName(value);
    if (!displayNameEdited) setDisplayName(`${firstName} ${value}`.trim());
  }

  function handleDisplayNameChange(event: ChangeEvent<HTMLInputElement>) {
    setDisplayName(event.target.value);
    setDisplayNameEdited(true);
  }

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

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim();
    const name = displayName.trim();

    if (!name || !email || !role) {
      setError("Compila nome visualizzato, email e ruolo.");
      return;
    }

    setSaving(true);
    try {
      await updateFriend(supabase, masterKey, friendId, { name, email, firstName, lastName, role });

      // Un invito non riuscito non deve impedire di aver salvato le
      // modifiche: si segnala con un parametro a parte, non un errore.
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
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {saving ? "Salvataggio…" : "Salva modifiche"}
            </button>
            <Link
              href="/friends"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Annulla
            </Link>
          </form>
        </>
      )}
    </div>
  );
}
