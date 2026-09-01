"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  countCategoryUsage,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/domain/categories/repository";
import type { Category } from "@/domain/categories/types";
import { IconPicker } from "@/components/ui/IconPicker";

const DEFAULT_ICON = "📁";

/**
 * Category CRUD --- no Master Key involved: names/icons are plaintext
 * (a generic label, not personal content, see the categories migration).
 */
export function CategoriesPanel() {
  const supabase = useRef(createClient()).current;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [createIcon, setCreateIcon] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setCategories(await listCategories(supabase));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare le categorie.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate elsewhere
    // in this app --- here it's simpler still: categories aren't encrypted,
    // this is just a normal client-side data fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const icon = String(formData.get("icon") ?? "").trim() || DEFAULT_ICON;

    if (!name) {
      setError("Inserisci un nome per la categoria.");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await createCategory(supabase, user.id, { name, icon });
      form.reset();
      setCreateIcon("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile creare la categoria.");
    } finally {
      setCreating(false);
    }
  }

  function startEditing(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditIcon(category.icon);
  }

  async function handleSaveEdit(category: Category) {
    if (!editName.trim()) {
      setError("Il nome della categoria non può essere vuoto.");
      return;
    }

    setBusyId(category.id);
    setError(null);
    try {
      await updateCategory(supabase, category.id, {
        name: editName.trim(),
        icon: editIcon.trim() || DEFAULT_ICON,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare la categoria.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(category: Category) {
    setBusyId(category.id);
    setError(null);

    let usage;
    try {
      usage = await countCategoryUsage(supabase, category.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossibile verificare l'utilizzo della categoria.",
      );
      setBusyId(null);
      return;
    }

    const usedBy: string[] = [];
    if (usage.documents > 0) {
      usedBy.push(usage.documents === 1 ? "1 documento" : `${usage.documents} documenti`);
    }
    if (usage.assets > 0) {
      usedBy.push(`${usage.assets} asset`);
    }

    const message =
      usedBy.length > 0
        ? `Attenzione: la categoria "${category.icon} ${category.name}" è collegata a ${usedBy.join(" e ")}. Eliminandola NON verranno cancellati: resteranno semplicemente senza categoria. Procedere comunque?`
        : `Eliminare la categoria "${category.icon} ${category.name}"? Nessun documento o asset è attualmente collegato.`;

    if (!window.confirm(message)) {
      setBusyId(null);
      return;
    }

    try {
      await deleteCategory(supabase, category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare la categoria.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Categorie</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Quelle iniziali sono un punto di partenza: aggiungi, rinomina o elimina le tue.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <div className="flex w-20 flex-col gap-1">
          <label htmlFor="icon" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Icona
          </label>
          <IconPicker
            id="icon"
            name="icon"
            value={createIcon}
            onChange={setCreateIcon}
            placeholder={DEFAULT_ICON}
          />
        </div>

        <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
          <label htmlFor="name" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Nome
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="es. Hobby"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </div>

        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {creating ? "Creazione…" : "Aggiungi categoria"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessuna categoria ancora.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {categories.map((category) => {
            const busy = busyId === category.id;
            const isEditing = editingId === category.id;

            if (isEditing) {
              return (
                <li key={category.id} className="flex flex-wrap items-end gap-3 p-4">
                  <div className="flex w-20 flex-col gap-1">
                    <label
                      htmlFor={`edit-${category.id}-icon`}
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                    >
                      Icona
                    </label>
                    <IconPicker
                      id={`edit-${category.id}-icon`}
                      value={editIcon}
                      onChange={setEditIcon}
                    />
                  </div>
                  <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
                    <label
                      htmlFor={`edit-${category.id}-name`}
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                    >
                      Nome
                    </label>
                    <input
                      id={`edit-${category.id}-name`}
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSaveEdit(category)}
                    className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                  >
                    {busy ? "Salvataggio…" : "Salva"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditingId(null)}
                    className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                  >
                    Annulla
                  </button>
                </li>
              );
            }

            return (
              <li key={category.id} className="flex items-center justify-between gap-4 p-4">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {category.icon} {category.name}
                </p>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startEditing(category)}
                    className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    Modifica
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(category)}
                    className="text-sm font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    Elimina
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
