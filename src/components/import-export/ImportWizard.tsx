"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { listCategories } from "@/domain/categories/repository";
import { listAssets } from "@/domain/assets/repository";
import { parseCsv } from "@/domain/import/csv";
import { IMPORT_KIND_SPECS, generateTemplateCsv, templateFilename } from "@/domain/import/templates";
import { findMissingColumns, parseAssetRows, parseContactRows, parseReminderRows } from "@/domain/import/validate";
import { importAssets, importContacts, importReminders } from "@/domain/import/repository";
import { isRowReady } from "@/domain/import/types";
import { saveBlobAsFile } from "@/lib/download";
import { ReferenceCell } from "@/components/import-export/ReferenceCell";
import type {
  AssetRow,
  ContactRow,
  ImportKind,
  ImportRow,
  ImportRowResult,
  ReferenceResolution,
  ReminderRow,
} from "@/domain/import/types";
import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";

type Step = 1 | 2 | 3 | 4 | 5;

const KIND_ORDER: ImportKind[] = ["contacts", "assets", "reminders"];

const DESTINATION_LINK: Record<ImportKind, { href: string; label: string }> = {
  contacts: { href: "/contacts", label: "Vai a Contatti" },
  assets: { href: "/assets", label: "Vai ad Asset" },
  reminders: { href: "/reminders", label: "Vai a Scadenze" },
};

/**
 * FASE successiva alla FASE 9 --- Importazione: wizard a 5 passi, tutto
 * su questa stessa pagina (nessuna navigazione tra route). Contatti
 * fiduciari e Asset non hanno dipendenze; le Scadenze qui importate sono
 * solo quelle libere, non legate a un documento --- quelle nasceranno in
 * futuro come effetto collaterale di HINTHIAL AI che legge i documenti
 * caricati (v. discussione FASE AI). La cifratura avviene qui, nel
 * browser, con la Master Key già sbloccata: il server riceve solo
 * ciphertext, stesso percorso di scrittura dei form manuali (domain/import/repository.ts
 * chiama semplicemente createTrustedContact/createAsset/createReminder in loop).
 */
export function ImportWizard({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [kind, setKind] = useState<ImportKind | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);

  async function refreshReferenceData() {
    const [cats, assetList] = await Promise.all([listCategories(supabase), listAssets(supabase, masterKey)]);
    setCategories(cats);
    setAssets(assetList);
  }

  useEffect(() => {
    refreshReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToStep1() {
    setStep(1);
    setKind(null);
    setRows([]);
    setResults(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleChooseKind(next: ImportKind) {
    setKind(next);
    setFileError(null);
    setStep(2);
  }

  function handleDownloadTemplate() {
    if (!kind) return;
    saveBlobAsFile(new Blob([generateTemplateCsv(kind)], { type: "text/csv;charset=utf-8" }), templateFilename(kind));
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !kind) return;
    setFileError(null);

    let csvRows: string[][];
    try {
      csvRows = parseCsv(await file.text());
    } catch {
      setFileError("Impossibile leggere il file. Assicurati che sia un .csv valido.");
      return;
    }

    if (csvRows.length === 0) {
      setFileError("Il file è vuoto.");
      return;
    }

    const missing = findMissingColumns(csvRows[0], kind);
    if (missing.length > 0) {
      setFileError(
        `Il file non contiene le colonne obbligatorie: ${missing.join(", ")}. Hai usato il template scaricato al passo precedente?`,
      );
      return;
    }

    const parsed: ImportRow[] =
      kind === "contacts"
        ? parseContactRows(csvRows)
        : kind === "assets"
          ? parseAssetRows(csvRows, categories)
          : parseReminderRows(csvRows, assets);

    if (parsed.length === 0) {
      setFileError("Nessuna riga da importare trovata nel file (solo l'intestazione?).");
      return;
    }

    setRows(parsed);
    setStep(4);
  }

  function updateReference(rowNumber: number, next: ReferenceResolution) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowNumber !== rowNumber) return row;
        if (row.kind === "assets") return { ...row, category: next };
        if (row.kind === "reminders") return { ...row, asset: next };
        return row;
      }),
    );
  }

  async function handleImport() {
    if (!kind) return;
    setBusy(true);
    setFileError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessione scaduta. Ricarica la pagina e riprova.");

      const outcome =
        kind === "contacts"
          ? await importContacts(supabase, masterKey, user.id, rows as ContactRow[])
          : kind === "assets"
            ? await importAssets(supabase, masterKey, user.id, rows as AssetRow[])
            : await importReminders(supabase, masterKey, user.id, rows as ReminderRow[]);

      setResults(outcome);
      setStep(5);
      await refreshReferenceData();
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Impossibile completare l'importazione. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  const readyCount = rows.filter(isRowReady).length;
  const blockedCount = rows.length - readyCount;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {["1. Tipo", "2. Template", "3. Carica file", "4. Anteprima", "5. Risultato"].map((label, i) => (
          <li key={label} className={step === i + 1 ? "font-semibold text-brand" : undefined}>
            {label}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Cosa vuoi importare?</p>
          <div className="flex flex-wrap gap-3">
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleChooseKind(k)}
                className="rounded-md border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 hover:border-brand hover:text-brand dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-brand"
              >
                {IMPORT_KIND_SPECS[k].label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 && kind ? (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Template: {IMPORT_KIND_SPECS[kind].label}
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Scarica il template, compilalo con una riga per ogni elemento da importare (puoi aprirlo e
              modificarlo con Excel, Numbers o Google Fogli: va bene sia la virgola sia il punto e virgola
              come separatore), poi caricalo al passo successivo.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-1.5 pr-4 font-medium">Colonna</th>
                  <th className="py-1.5 pr-4 font-medium">Obbligatoria</th>
                  <th className="py-1.5 font-medium">Descrizione</th>
                </tr>
              </thead>
              <tbody>
                {IMPORT_KIND_SPECS[kind].columns.map((col) => (
                  <tr key={col.key} className="border-b border-zinc-100 align-top dark:border-zinc-900">
                    <td className="py-1.5 pr-4 font-medium text-zinc-900 dark:text-zinc-100">{col.label}</td>
                    <td className="py-1.5 pr-4 text-zinc-500 dark:text-zinc-400">
                      {col.required ? "Sì" : "No"}
                    </td>
                    <td className="py-1.5 text-zinc-500 dark:text-zinc-400">{col.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="w-fit rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
            >
              ⬇️ Scarica template .csv
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Avanti
            </button>
            <button
              type="button"
              onClick={goToStep1}
              className="w-fit text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Cambia tipo
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && kind ? (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Carica il file compilato</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Seleziona il file .csv che hai compilato a partire dal template di{" "}
              {IMPORT_KIND_SPECS[kind].label.toLowerCase()}.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="text-sm text-zinc-700 dark:text-zinc-300"
          />

          {fileError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {fileError}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-fit text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            Indietro
          </button>
        </div>
      ) : null}

      {step === 4 && kind ? (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Anteprima</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {readyCount} {readyCount === 1 ? "riga pronta" : "righe pronte"} per l&apos;importazione.
              {blockedCount > 0
                ? ` ${blockedCount} ${blockedCount === 1 ? "riga richiede" : "righe richiedono"} una correzione prima di poter essere importata${blockedCount === 1 ? "" : "e"}.`
                : ""}
            </p>
          </div>

          <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            {kind === "contacts" ? (
              <ContactsPreviewTable rows={rows as ContactRow[]} />
            ) : kind === "assets" ? (
              <AssetsPreviewTable rows={rows as AssetRow[]} categories={categories} onResolve={updateReference} />
            ) : (
              <RemindersPreviewTable rows={rows as ReminderRow[]} assets={assets} onResolve={updateReference} />
            )}
          </div>

          {fileError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {fileError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={busy || readyCount === 0}
              className="w-fit rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {busy ? "Importazione…" : `Importa ${readyCount} ${readyCount === 1 ? "riga" : "righe"}`}
            </button>
            <button
              type="button"
              onClick={goToStep1}
              disabled={busy}
              className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : null}

      {step === 5 && kind && results ? (
        <ImportResultView kind={kind} results={results} onRestart={goToStep1} />
      ) : null}
    </div>
  );
}

function RowStatusBadge({ row }: { row: ImportRow }) {
  const ready = isRowReady(row);
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        ready
          ? "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400"
          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
      }`}
    >
      {ready ? "Pronta" : "Da correggere"}
    </span>
  );
}

function ContactsPreviewTable({ rows }: { rows: ContactRow[] }) {
  return (
    <table className="w-full min-w-[36rem] text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <th className="px-3 py-2 font-medium">Riga</th>
          <th className="px-3 py-2 font-medium">Nome</th>
          <th className="px-3 py-2 font-medium">Email</th>
          <th className="px-3 py-2 font-medium">Ruolo</th>
          <th className="px-3 py-2 font-medium">Stato</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.rowNumber} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
            <td className="px-3 py-2 text-zinc-400 dark:text-zinc-600">{row.rowNumber}</td>
            <td className="px-3 py-2">
              {row.name || <span className="text-red-600 dark:text-red-400">{row.fieldErrors.name}</span>}
            </td>
            <td className="px-3 py-2">
              {row.fieldErrors.email ? (
                <span className="text-red-600 dark:text-red-400">
                  {row.email || row.fieldErrors.email}
                  {row.email ? ` (${row.fieldErrors.email})` : ""}
                </span>
              ) : (
                row.email
              )}
            </td>
            <td className="px-3 py-2">
              {row.role || <span className="text-red-600 dark:text-red-400">{row.fieldErrors.role}</span>}
            </td>
            <td className="px-3 py-2">
              <RowStatusBadge row={row} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AssetsPreviewTable({
  rows,
  categories,
  onResolve,
}: {
  rows: AssetRow[];
  categories: Category[];
  onResolve: (rowNumber: number, next: ReferenceResolution) => void;
}) {
  return (
    <table className="w-full min-w-[32rem] text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <th className="px-3 py-2 font-medium">Riga</th>
          <th className="px-3 py-2 font-medium">Nome</th>
          <th className="px-3 py-2 font-medium">Categoria</th>
          <th className="px-3 py-2 font-medium">Stato</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.rowNumber} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
            <td className="px-3 py-2 text-zinc-400 dark:text-zinc-600">{row.rowNumber}</td>
            <td className="px-3 py-2">
              {row.name || <span className="text-red-600 dark:text-red-400">{row.fieldErrors.name}</span>}
            </td>
            <td className="px-3 py-2">
              <ReferenceCell
                resolution={row.category}
                existing={categories}
                entityLabel="categoria"
                onChange={(next) => onResolve(row.rowNumber, next)}
              />
            </td>
            <td className="px-3 py-2">
              <RowStatusBadge row={row} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RemindersPreviewTable({
  rows,
  assets,
  onResolve,
}: {
  rows: ReminderRow[];
  assets: AssetListItem[];
  onResolve: (rowNumber: number, next: ReferenceResolution) => void;
}) {
  return (
    <table className="w-full min-w-[36rem] text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <th className="px-3 py-2 font-medium">Riga</th>
          <th className="px-3 py-2 font-medium">Titolo</th>
          <th className="px-3 py-2 font-medium">Data scadenza</th>
          <th className="px-3 py-2 font-medium">Asset collegato</th>
          <th className="px-3 py-2 font-medium">Stato</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.rowNumber} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
            <td className="px-3 py-2 text-zinc-400 dark:text-zinc-600">{row.rowNumber}</td>
            <td className="px-3 py-2">
              {row.title || <span className="text-red-600 dark:text-red-400">{row.fieldErrors.title}</span>}
            </td>
            <td className="px-3 py-2">
              {row.fieldErrors.dueAt ? (
                <span className="text-red-600 dark:text-red-400">
                  {row.dueAtRaw || row.fieldErrors.dueAt}
                  {row.dueAtRaw ? ` (${row.fieldErrors.dueAt})` : ""}
                </span>
              ) : (
                row.dueAtRaw
              )}
            </td>
            <td className="px-3 py-2">
              <ReferenceCell
                resolution={row.asset}
                existing={assets}
                entityLabel="asset"
                onChange={(next) => onResolve(row.rowNumber, next)}
              />
            </td>
            <td className="px-3 py-2">
              <RowStatusBadge row={row} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ImportResultView({
  kind,
  results,
  onRestart,
}: {
  kind: ImportKind;
  results: ImportRowResult[];
  onRestart: () => void;
}) {
  const imported = results.filter((r) => r.status === "imported");
  const skipped = results.filter((r) => r.status === "skipped");
  const destination = DESTINATION_LINK[kind];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Importazione completata</h3>
        <p className="mt-1 text-sm text-lime-700 dark:text-lime-400">
          {imported.length} {imported.length === 1 ? "elemento importato" : "elementi importati"}.
        </p>
        {skipped.length > 0 ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {skipped.length} {skipped.length === 1 ? "riga saltata" : "righe saltate"}.
          </p>
        ) : null}
      </div>

      {skipped.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          {skipped.map((r) => (
            <li key={r.rowNumber}>
              Riga {r.rowNumber}: {r.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href={destination.href}
          className="w-fit rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          {destination.label}
        </Link>
        <button
          type="button"
          onClick={onRestart}
          className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Importa un altro file
        </button>
      </div>
    </div>
  );
}
