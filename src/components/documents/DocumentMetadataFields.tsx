"use client";

import { useState } from "react";
import { sortAlphabetically } from "@/lib/utils";
import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { DossierListItem } from "@/domain/dossiers/types";
import type { DocumentListItem } from "@/domain/documents/types";

export interface DocumentMetadataFieldsValue {
  categoryId: string;
  relatedAssetId: string;
  /** Indipendente dalla categoria: un fascicolo attraversa le categorie. Un documento può stare in più fascicoli insieme, quindi un insieme e non un singolo valore. */
  dossierIds: string[];
  /** yyyy-mm-dd, or "" for no expiry. */
  expiresAt: string;
  notes: string;
  /** comma-separated, parsed via parseTagsInput. */
  tagsInput: string;
  /** Chi ha emesso il documento --- "" se non impostato (v. FASE 18/19, campo proponibile). */
  issuer: string;
}

export const EMPTY_METADATA_FIELDS: DocumentMetadataFieldsValue = {
  categoryId: "",
  relatedAssetId: "",
  dossierIds: [],
  expiresAt: "",
  notes: "",
  tagsInput: "",
  issuer: "",
};

/** Converte un DocumentListItem già decifrato nei valori di partenza del form --- usato sia dall'edit inline (DocumentsPanel) sia dalla pagina di modifica dedicata (EditArchiveItemForm). */
export function documentToFields(doc: DocumentListItem): DocumentMetadataFieldsValue {
  return {
    categoryId: doc.categoryId ?? "",
    relatedAssetId: doc.relatedAssetId ?? "",
    dossierIds: doc.dossierIds,
    expiresAt: doc.expiresAt ? doc.expiresAt.slice(0, 10) : "",
    notes: doc.notes,
    tagsInput: doc.tags.join(", "),
    issuer: doc.issuer,
  };
}

export function parseTagsInput(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function DocumentMetadataFields({
  idPrefix,
  categories,
  assets,
  dossiers = [],
  value,
  onChange,
  showExpiry = true,
  hints,
}: {
  idPrefix: string;
  categories: Category[];
  assets: AssetListItem[];
  /** Opzionale e di default vuoto: i chiamanti senza un elenco di fascicoli a portata di mano non mostrano il selettore. */
  dossiers?: DossierListItem[];
  value: DocumentMetadataFieldsValue;
  onChange: (next: DocumentMetadataFieldsValue) => void;
  /** Nascosto in creazione dove chiederla non ha ancora senso (audio, video, note): il documento viene letto appena scelto, e se una scadenza c'è dentro la trova da sé. */
  showExpiry?: boolean;
  /** Una riga sotto a un campo per dire chi ce l'ha messo e da dove viene. Sta qui perché è questo componente a possedere il layout dei campi. */
  hints?: Partial<Record<"categoryId" | "relatedAssetId" | "dossierIds" | "expiresAt", React.ReactNode>>;
}) {
  // Fascicolo da aggiungere, scelto nel select ma non ancora confermato col bottone "+ Aggiungi fascicolo".
  const [dossierToAdd, setDossierToAdd] = useState("");

  // La categoria filtra i beni proposti: senza categoria selezionata, nessun bene è proponibile.
  const filteredAssets = value.categoryId
    ? sortAlphabetically(
        assets.filter((asset) => asset.categoryId === value.categoryId),
        (asset) => asset.name,
      )
    : [];

  const pickableDossiers = sortAlphabetically(
    dossiers.filter((dossier) => !value.dossierIds.includes(dossier.id)),
    (dossier) => dossier.title,
  );

  function handleAddDossier() {
    if (!dossierToAdd) return;
    onChange({ ...value, dossierIds: [...value.dossierIds, dossierToAdd] });
    setDossierToAdd("");
  }

  function handleRemoveDossier(dossierId: string) {
    onChange({ ...value, dossierIds: value.dossierIds.filter((id) => id !== dossierId) });
  }

  function handleCategoryChange(categoryId: string) {
    // Se il bene già selezionato non appartiene alla nuova categoria, deseleziona.
    const nextAssets = categoryId ? assets.filter((asset) => asset.categoryId === categoryId) : [];
    const relatedAssetId = nextAssets.some((asset) => asset.id === value.relatedAssetId)
      ? value.relatedAssetId
      : "";
    onChange({ ...value, categoryId, relatedAssetId });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-category`}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Categoria
          </label>
          <select
            id={`${idPrefix}-category`}
            value={value.categoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="">Nessuna categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
          {hints?.categoryId}
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-asset`}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Bene collegato
          </label>
          <select
            id={`${idPrefix}-asset`}
            value={value.relatedAssetId}
            onChange={(e) => onChange({ ...value, relatedAssetId: e.target.value })}
            disabled={!value.categoryId}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="">{value.categoryId ? "Nessuno" : "Scegli prima una categoria"}</option>
            {filteredAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
          {hints?.relatedAssetId}
        </div>

        {showExpiry ? (
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${idPrefix}-expires`}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Scadenza
            </label>
            <input
              id={`${idPrefix}-expires`}
              type="date"
              value={value.expiresAt}
              onChange={(e) => onChange({ ...value, expiresAt: e.target.value })}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            {hints?.expiresAt}
          </div>
        ) : null}
      </div>

      {/* Nessun filtro per categoria: un fascicolo attraversa le categorie di proposito. Scegli-e-aggiungi invece di <select multiple>, poco leggibile senza Ctrl/Cmd-click. */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${idPrefix}-dossier`}
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Fascicoli
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            id={`${idPrefix}-dossier`}
            value={dossierToAdd}
            onChange={(e) => setDossierToAdd(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="">Aggiungi a un fascicolo…</option>
            {pickableDossiers.map((dossier) => (
              <option key={dossier.id} value={dossier.id}>
                {dossier.status === "closed" ? "🗂️ " : "📂 "}
                {dossier.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!dossierToAdd}
            onClick={handleAddDossier}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            + Aggiungi fascicolo
          </button>
        </div>
        {value.dossierIds.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {value.dossierIds.map((dossierId) => {
              const dossier = dossiers.find((d) => d.id === dossierId);
              if (!dossier) return null;
              return (
                <li
                  key={dossierId}
                  className="flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <span>
                    {dossier.status === "closed" ? "🗂️" : "📂"} {dossier.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDossier(dossierId)}
                    aria-label={`Rimuovi ${dossier.title}`}
                    className="rounded-full px-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {hints?.dossierIds}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${idPrefix}-issuer`}
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Emittente
        </label>
        <input
          id={`${idPrefix}-issuer`}
          type="text"
          value={value.issuer}
          onChange={(e) => onChange({ ...value, issuer: e.target.value })}
          placeholder="es. Generali Italia S.p.A."
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${idPrefix}-tags`}
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Tag (separati da virgola)
        </label>
        <input
          id={`${idPrefix}-tags`}
          type="text"
          value={value.tagsInput}
          onChange={(e) => onChange({ ...value, tagsInput: e.target.value })}
          placeholder="es. fattura, 2026, casa"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${idPrefix}-notes`}
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Note
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>
    </div>
  );
}
