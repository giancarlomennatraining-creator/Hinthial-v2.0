"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFriendNameFields } from "@/components/friends/useFriendNameFields";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { createFriend, updateFriendAvatar } from "@/domain/friends/repository";
import { inviteFriendToHinthial } from "@/lib/friends/actions";
import { AvatarPickerCrop } from "@/components/ui/AvatarPickerCrop";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_FIELD } from "@/components/ui/styles";

/** Un seed stabile per il colore delle iniziali finché l'amico non ha ancora un id --- basta che non cambi ad ogni digitazione. */
function avatarSeedFor(firstName: string, lastName: string): string {
  return `${firstName}-${lastName}` || "new-friend";
}

/** Pagina di creazione di un amico. Alla creazione torna a /friends con `?created=1`, mai il nome (finirebbe in chiaro nella cronologia del browser). */
export function CreateFriendForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState(false);

  const { firstName, lastName, displayName, handleFirstNameChange, handleLastNameChange, handleDisplayNameChange } =
    useFriendNameFields();

  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  function handleAvatarCropped(blob: Blob) {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarBlob(blob);
    setAvatarPreviewUrl(URL.createObjectURL(blob));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
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

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const created = await createFriend(supabase, masterKey, user.id, {
        name,
        email,
        firstName,
        lastName,
        role,
      });

      // Una foto scelta ma non salvata non deve impedire di salvare l'amico: un fallimento si segnala a parte.
      let avatarFailed = false;
      if (avatarBlob) {
        try {
          await updateFriendAvatar(supabase, user.id, created.id, avatarBlob, null);
        } catch {
          avatarFailed = true;
        }
      }

      // Un invito non riuscito non deve impedire il salvataggio: si segnala con un parametro a parte.
      let inviteFailed = false;
      if (invite) {
        try {
          await inviteFriendToHinthial(email);
        } catch {
          inviteFailed = true;
        }
      }

      router.push(
        `/friends?created=1${inviteFailed ? "&inviteFailed=1" : ""}${avatarFailed ? "&avatarFailed=1" : ""}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiungere l'amico.");
      setCreating(false);
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
          Nuovo amico
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Una persona che potrà essere autorizzata in futuro ad accedere ai tuoi dati. Per ora
          questa sezione registra solo l&apos;amico e il suo stato — nessun accesso viene concesso
          automaticamente.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
        <p className="mb-3 text-xs font-medium text-zinc-600 dark:text-zinc-400">Foto (facoltativa)</p>
        <AvatarPickerCrop
          currentAvatarUrl={avatarPreviewUrl}
          fallbackFirstName={firstName}
          fallbackLastName={lastName}
          fallbackSeed={avatarSeedFor(firstName, lastName)}
          onCropped={handleAvatarCropped}
        />
      </div>

      <form
        onSubmit={handleCreate}
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
            placeholder="es. Maria"
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
            placeholder="es. Rossi"
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
            placeholder="es. Maria Rossi"
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
            placeholder="maria.rossi@esempio.it"
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
            placeholder="es. Coniuge"
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
          disabled={creating}
          className={`${BTN_PRIMARY} disabled:opacity-50`}
        >
          {creating ? "Aggiunta…" : "Aggiungi amico"}
        </button>
        <Link
          href="/friends"
          className={BTN_SECONDARY}
        >
          Annulla
        </Link>
      </form>
    </div>
  );
}

