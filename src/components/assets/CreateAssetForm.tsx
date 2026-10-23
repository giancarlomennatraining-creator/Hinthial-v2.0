"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { createAsset } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import type { Category } from "@/domain/categories/types";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_FIELD, PANEL } from "@/components/ui/styles";
import { BackLink } from "@/components/ui/BackLink";
import { ErrorText } from "@/components/ui/ErrorText";
import { LoadingText } from "@/components/ui/LoadingText";
import { errorMessage } from "@/lib/utils";

/**
 * Pagina dedicata alla creazione di un bene (estratta da AssetsPanel,
 * che ora mostra solo l'elenco più un tasto "+ Crea bene"). Stesso
 * pattern usato per le capsule: alla creazione riuscita torna a /assets
 * con un messaggio di conferma passato come flag nell'URL (`?created=1`),
 * mai il nome del bene --- finirebbe in chiaro nella cronologia del
 * browser, in contrasto con lo zero-knowledge.
 */
export function CreateAssetForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setCategories(await listCategories(supabase));
    } catch (err) {
      setError(errorMessage(err, "Impossibile caricare le categorie."));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const categoryId = String(formData.get("categoryId") ?? "") || null;
    const legacyNote = String(formData.get("legacyNote") ?? "");

    if (!name) {
      setError("Inserisci un nome per il bene.");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await createAsset(supabase, masterKey, user.id, { name, categoryId, legacyNote });
      router.push("/assets?created=1");
    } catch (err) {
      setError(errorMessage(err, "Impossibile creare il bene."));
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/assets">Torna ai beni</BackLink>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-title">
          Nuovo bene
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Censisci beni e contratti (casa, veicoli, assicurazioni, ...).
        </p>
      </div>

      {loading ? (
        <LoadingText />
      ) : (
        <form
          onSubmit={handleCreate}
          className={`${PANEL} flex flex-wrap items-end gap-3 p-4`}
        >
          <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nome
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="es. Casa di Via Roma"
              className={INPUT_FIELD}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="categoryId"
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Categoria
            </label>
            <select
              id="categoryId"
              name="categoryId"
              className={INPUT_FIELD}
            >
              <option value="">Nessuna categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>


          <div className="flex w-full flex-col gap-1">
            <label htmlFor="legacyNote" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Cosa succede a questo bene <span className="font-normal">(facoltativo)</span>
            </label>
            <textarea
              id="legacyNote"
              name="legacyNote"
              rows={2}
              placeholder="es. Va a Luca. Le chiavi sono dal vicino del secondo piano."
              className={INPUT_FIELD}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Resta cifrata e la vedi solo tu. Per farla arrivare a qualcuno, scrivila anche in una capsula.
            </p>
          </div>

          {error ? (
            <ErrorText className="w-full">
              {error}
            </ErrorText>
          ) : null}

          <button
            type="submit"
            disabled={creating}
            className={`${BTN_PRIMARY} disabled:opacity-50`}
          >
            {creating ? "Creazione…" : "Aggiungi bene"}
          </button>
          <Link
            href="/assets"
            className={BTN_SECONDARY}
          >
            Annulla
          </Link>
        </form>
      )}
    </div>
  );
}
