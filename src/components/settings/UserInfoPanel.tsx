"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { updateProfile } from "@/domain/profile/repository";
import { TextField } from "@/components/ui/TextField";
import { AvatarUploadForm } from "@/components/settings/AvatarUploadForm";
import { BTN_PRIMARY } from "@/components/ui/styles";

function translateEmailChangeError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("email address already")
  ) {
    return "Esiste già un account con questa email.";
  }
  if (normalized.includes("error sending")) {
    return "Non è stato possibile inviare l'email di conferma. Riprova tra qualche minuto.";
  }
  if (normalized.includes("rate limit")) {
    return "Troppi tentativi. Riprova tra qualche minuto.";
  }
  return "Si è verificato un errore. Riprova.";
}

/** Due sezioni indipendenti: rinomina (scrive direttamente su `profiles`) e cambio email (operazione Supabase Auth, richiede conferma, non ha effetto immediato). */
export function UserInfoPanel({
  userId,
  firstName: initialFirstName,
  lastName: initialLastName,
  email: currentEmail,
  avatarPath,
  avatarUrl,
  birthDate: initialBirthDate,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  birthDate: string | null;
}) {
  const supabase = useSupabase();
  const router = useRouter();

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [birthDate, setBirthDate] = useState(initialBirthDate ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  async function handleSaveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError(null);
    setNameSaved(false);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst || !trimmedLast) {
      setNameError("Nome e cognome non possono essere vuoti.");
      return;
    }

    setNameSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await updateProfile(supabase, user.id, {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        birthDate: birthDate || null,
      });
      setNameSaved(true);
      // Il nome in sidebar/saluto viene da un Server Component (getCurrentUser): va rinfrescato.
      router.refresh();
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Impossibile aggiornare il profilo.");
    } finally {
      setNameSaving(false);
    }
  }

  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailRequested, setEmailRequested] = useState(false);

  async function handleChangeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    setEmailRequested(false);

    const trimmed = newEmail.trim();
    if (!trimmed) {
      setEmailError("Inserisci una nuova email.");
      return;
    }
    if (trimmed === currentEmail) {
      setEmailError("È già la tua email attuale.");
      return;
    }

    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw new Error(translateEmailChangeError(error.message));
      setEmailRequested(true);
      setNewEmail("");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Impossibile richiedere il cambio email.");
    } finally {
      setEmailSaving(false);
    }
  }

  return (
    // @container: i tre campi si affiancano in base allo spazio vero del pannello, non della finestra.
    <div className="@container flex flex-col gap-8">
      <div className="max-w-md">
        <AvatarUploadForm
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          avatarPath={avatarPath}
          avatarUrl={avatarUrl}
        />
      </div>

      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Dati personali
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Nome e cognome sono mostrati nell&apos;app; la data di nascita è facoltativa.
          </p>
        </div>

        <form onSubmit={handleSaveName} className="flex flex-col gap-4">
          {/* Tre campi affiancati quando il pannello ha spazio, uno sotto l'altro quando si restringe. */}
          <div className="grid gap-4 @xl:grid-cols-3">
            <TextField
              id="firstName"
              name="firstName"
              label="Nome"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <TextField
              id="lastName"
              name="lastName"
              label="Cognome"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
            <TextField
              id="birthDate"
              name="birthDate"
              label="Data di nascita"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

          {nameError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {nameError}
            </p>
          ) : null}
          {nameSaved ? (
            <p className="text-sm text-green-700 dark:text-green-400">Salvato.</p>
          ) : null}

          <button
            type="submit"
            disabled={nameSaving}
            className={`self-start ${BTN_PRIMARY} disabled:opacity-50`}
          >
            {nameSaving ? "Salvataggio…" : "Salva"}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Email</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Email attuale:{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{currentEmail}</span>
          </p>
        </div>

        <form onSubmit={handleChangeEmail} className="flex max-w-md flex-col gap-4">
          <TextField
            id="newEmail"
            name="newEmail"
            label="Nuova email"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />

          {emailError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {emailError}
            </p>
          ) : null}
          {emailRequested ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              Controlla la posta per confermare il cambio email (potrebbe servire confermare sia
              dal nuovo che dal vecchio indirizzo). Finché non confermi, l&apos;email attuale
              resta valida per accedere.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={emailSaving}
            className={`self-start ${BTN_PRIMARY} disabled:opacity-50`}
          >
            {emailSaving ? "Invio…" : "Cambia email"}
          </button>
        </form>
      </section>
    </div>
  );
}
