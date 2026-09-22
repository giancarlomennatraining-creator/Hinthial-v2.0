"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { listDocuments, uploadDocument } from "@/domain/documents/repository";
import { listCategories } from "@/domain/categories/repository";
import { createDossier, listDossiers } from "@/domain/dossiers/repository";
import { canExtractText, extractText } from "@/domain/extraction/extract-text";
import { extractStructuredFields } from "@/domain/extraction/structured-fields";
import { heuristicCategorizer } from "@/domain/categorizer/heuristic-provider";
import { groupByIssuer, type ImportGroup } from "@/domain/bulk-import/grouping";
import { detectDuplicates } from "@/domain/bulk-import/duplicates";
import { GoogleDriveBrowser } from "@/components/documents/GoogleDriveBrowser";
import { sortAlphabetically } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import type { Category } from "@/domain/categories/types";
import type { DocumentMetadataInput } from "@/domain/documents/types";

/** Pubblica di natura (v. .env.local) --- undefined se la FASE 25 non è configurata in questo ambiente: in quel caso il bottone sotto non compare, invece di rompersi al clic. */
const GOOGLE_DRIVE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;

/**
 * FASE 21 --- import massivo: molti file in una volta, con un
 * **riepilogo per gruppi** invece di una conferma per file (dal piano).
 * Chi carica venti bollette non vuole ripetere venti volte lo stesso
 * form --- vuole vedere in un colpo d'occhio cosa Hinthial ha capito e
 * dire un solo sì.
 *
 * "Riconoscimento di insiemi" e "proposta di fascicoli dai
 * raggruppamenti evidenti" sono la stessa cosa qui: file con lo stesso
 * emittente (v. domain/bulk-import/grouping.ts) --- deterministico, mai
 * una somiglianza vaga. Un fascicolo esistente con lo stesso emittente
 * si aggancia; un gruppo di almeno due file senza un fascicolo propone
 * di crearne uno.
 *
 * Scope deliberatamente più stretto del caricamento singolo (v.
 * CreateArchiveItemForm, FASE 19b): niente bene collegato, niente
 * scadenza per singolo file --- un riepilogo con troppi campi per riga
 * tradirebbe il punto stesso di questa pagina. Chi ha bisogno di quel
 * livello di dettaglio lo aggiunge dopo, dalla scheda del documento.
 */

interface DraftFile {
  id: string;
  file: File;
  text: string | null;
  /** "" --- usa il nome del file. */
  title: string;
  /** "" --- nessuna categoria. */
  categoryId: string;
  /** Nome della cartella Google Drive di provenienza (FASE 25), solo come suggerimento di categoria --- null se scelto dal disco o come file singolo. */
  folderHint: string | null;
  /** Fotografia di categoryId al momento del suggerimento --- se l'utente cambia la select, i due smettono di coincidere e il badge "suggerita" scompare da sé, senza un flag a parte da tenere sincronizzato. */
  suggestedCategoryId: string;
  /** Un file già in Archivio (o un altro in questo stesso lotto) con lo stesso nome e la stessa dimensione --- corrispondenza esatta, mai una somiglianza vaga (stessa disciplina di findIssuer). null se nessuna corrispondenza. */
  duplicateOf: { filename: string; createdAt: string } | null;
}

/** Un file da leggere, insieme al nome della cartella Google Drive da cui arriva --- se ce n'è una (v. FASE 25). */
interface FileToRead {
  file: File;
  folderHint: string | null;
}

type Phase =
  | { step: "idle" }
  | { step: "reading"; done: number; total: number }
  | { step: "reviewing" }
  | { step: "importing"; done: number; total: number };

export function BulkImportForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const showToast = useToast();

  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<ImportGroup<DraftFile>[]>([]);
  // Per gruppo (indice in `groups`): se collegarlo a un fascicolo, e con
  // che titolo se è un fascicolo nuovo da creare.
  const [groupLink, setGroupLink] = useState<boolean[]>([]);
  const [newDossierTitles, setNewDossierTitles] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [driveOpen, setDriveOpen] = useState(false);
  const [importSource, setImportSource] = useState<"disk" | "drive" | null>(null);

  /**
   * Il cuore della pagina, indipendente da dove arrivano i file --- dal
   * disco (handleFilesPicked) o da Google Drive (handleGoogleDriveImport,
   * FASE 25). `folderHint`, quando c'è, è solo un suggerimento in più per
   * la categoria (v. sotto): non diventa un dato salvato, non introduce
   * un costrutto "cartella" nell'archivio (v. discussione con l'utente
   * --- i Fascicoli già coprono, meglio, quel bisogno).
   */
  async function processFiles(toRead: FileToRead[]) {
    if (toRead.length === 0) return;
    setError(null);

    setPhase({ step: "reading", done: 0, total: toRead.length });

    // Uno alla volta, non in parallelo --- ognuno richiede di leggere il
    // file e, per i tipi che lo prevedono, farlo passare per l'OCR: farne
    // partire dieci insieme su un telefono lo farebbe solo arrancare
    // (stessa scelta già fatta per il recupero dei contenuti storici, v.
    // FASE 17b).
    const read: DraftFile[] = [];
    for (const [index, { file, folderHint }] of toRead.entries()) {
      const mimeType = file.type || "application/octet-stream";
      let text: string | null = null;
      if (canExtractText(mimeType)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        text = await extractText(bytes, mimeType);
      }
      read.push({
        id: crypto.randomUUID(),
        file,
        text,
        title: "",
        categoryId: "",
        folderHint,
        suggestedCategoryId: "",
        duplicateOf: null,
      });
      setPhase({ step: "reading", done: index + 1, total: toRead.length });
    }

    try {
      const [existingDocuments, categoriesResult, existingDossiers] = await Promise.all([
        listDocuments(supabase, masterKey),
        listCategories(supabase),
        listDossiers(supabase, masterKey),
      ]);
      setCategories(categoriesResult);

      // Suggerimenti per file --- stessa logica della FASE 19b
      // (applySuggestions in CreateArchiveItemForm), ma senza titolo,
      // bene o scadenza: qui contano solo categoria e raggruppamento.
      for (const draft of read) {
        if (draft.text) {
          const suggestion = heuristicCategorizer.suggestCategoryFromContent(
            draft.file.name,
            draft.text,
            categoriesResult,
          );
          if (suggestion) draft.categoryId = suggestion;

          const title = extractStructuredFields(draft.text).find((f) => f.kind === "title")?.value;
          if (title) draft.title = title;
        }

        // Il nome della cartella conta solo se il contenuto non ha già
        // suggerito una categoria --- un indizio più debole di quanto
        // Hinthial ha già letto nel file stesso, non lo sovrascrive.
        if (!draft.categoryId && draft.folderHint) {
          const folderHint = draft.folderHint;
          const match = categoriesResult.find((c) => c.name.toLowerCase() === folderHint.toLowerCase());
          if (match) draft.categoryId = match.id;
        }

        // Fotografia del suggerimento --- v. commento su DraftFile.suggestedCategoryId.
        draft.suggestedCategoryId = draft.categoryId;
      }

      // Rilevamento duplicati (FASE 25) --- v. domain/bulk-import/duplicates.ts.
      const duplicates = detectDuplicates(read, existingDocuments);
      read.forEach((draft, i) => {
        draft.duplicateOf = duplicates[i];
      });

      const computedGroups = groupByIssuer(read, existingDocuments, existingDossiers);
      setGroups(computedGroups);
      // Le proposte (fascicolo esistente o nuovo) partono selezionate:
      // sono raggruppamenti evidenti, non un'ipotesi debole --- l'utente
      // le disattiva se non le vuole, non il contrario.
      setGroupLink(computedGroups.map((g) => Boolean(g.existingDossier || g.proposedDossierTitle)));
      setNewDossierTitles(computedGroups.map((g) => g.proposedDossierTitle ?? ""));
      setPhase({ step: "reviewing" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile leggere i file scelti.");
      setPhase({ step: "idle" });
    }
  }

  async function handleFilesPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setImportSource("disk");
    await processFiles(files.map((file) => ({ file, folderHint: null })));
  }

  /**
   * FASE 25 --- import da Google Drive: il file browser (v.
   * GoogleDriveBrowser.tsx) gira per intero nel browser dell'utente, il
   * nostro server non vede né il token né i file scelti. Restituisce
   * File già scaricati --- da qui in avanti indistinguibili da uno
   * scelto dal disco: stessa lettura, stesso raggruppamento, stessa
   * cifratura all'importazione finale, nessun percorso a parte.
   */
  function handleGoogleDriveImported(downloaded: FileToRead[]) {
    setDriveOpen(false);
    setImportSource("drive");
    void processFiles(downloaded);
  }

  function updateDraft(id: string, patch: Partial<Pick<DraftFile, "title" | "categoryId">>) {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        files: group.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      })),
    );
  }

  /** Toglie un file dal lotto prima di importare --- pensata per un duplicato che non vale la pena riportare dentro. Se il gruppo resta vuoto, sparisce anche lui (e la sua proposta di fascicolo con lui). */
  function excludeDraft(id: string) {
    const groupIndex = groups.findIndex((g) => g.files.some((f) => f.id === id));
    if (groupIndex === -1) return;
    const remainingFiles = groups[groupIndex].files.filter((f) => f.id !== id);
    if (remainingFiles.length > 0) {
      setGroups((prev) => prev.map((g, i) => (i === groupIndex ? { ...g, files: remainingFiles } : g)));
    } else {
      setGroups((prev) => prev.filter((_, i) => i !== groupIndex));
      setGroupLink((prev) => prev.filter((_, i) => i !== groupIndex));
      setNewDossierTitles((prev) => prev.filter((_, i) => i !== groupIndex));
    }
  }

  async function handleImportAll() {
    setError(null);

    const totalFiles = groups.reduce((sum, g) => sum + g.files.length, 0);
    setPhase({ step: "importing", done: 0, total: totalFiles });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      let imported = 0;
      let failures = 0;
      let dossiersCreated = 0;

      for (const [groupIndex, group] of groups.entries()) {
        // Un fascicolo nuovo si crea una volta per gruppo, non una volta
        // per file --- altrimenti dieci bollette dello stesso fornitore
        // finirebbero in dieci fascicoli diversi.
        let dossierId: string | null = group.existingDossier?.id ?? null;
        if (!dossierId && groupLink[groupIndex] && group.proposedDossierTitle) {
          const title = newDossierTitles[groupIndex]?.trim() || group.proposedDossierTitle;
          try {
            dossierId = await createDossier(supabase, masterKey, user.id, { title, description: "" });
            dossiersCreated++;
          } catch {
            dossierId = null; // il fascicolo non nasce, ma i file si salvano comunque.
          }
        } else if (dossierId && !groupLink[groupIndex]) {
          dossierId = null;
        }

        for (const draft of group.files) {
          const metadata: DocumentMetadataInput = {
            categoryId: draft.categoryId || null,
            relatedAssetId: null,
            dossierIds: dossierId ? [dossierId] : [],
            expiresAt: null,
            notes: "",
            tags: [],
          };

          try {
            await uploadDocument(supabase, masterKey, user.id, draft.file, metadata, {
              title: draft.title || undefined,
              extraction: { text: draft.text, attempted: canExtractText(draft.file.type || "") },
            });
            imported++;
          } catch {
            // Un file che non si riesce a salvare non deve fermare gli
            // altri --- si conta e si prosegue (stessa scelta del
            // recupero testi in FASE 17b).
            failures++;
          }
          setPhase({ step: "importing", done: imported + failures, total: totalFiles });
        }
      }

      showToast(
        failures === 0
          ? `${imported} ${imported === 1 ? "contenuto importato" : "contenuti importati"}${
              dossiersCreated > 0 ? `, ${dossiersCreated} nuovo fascicolo` : ""
            }.`
          : `${imported} importati, ${failures} non riusciti.`,
      );
      router.push("/archive");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile importare i file.");
      setPhase({ step: "reviewing" });
    }
  }

  const sortedCategories = sortAlphabetically(categories, (c) => c.name);

  // Riepilogo in cima alla revisione --- letto dal vivo da `groups`, non
  // fotografato una volta: riflette subito ogni categoria che l'utente
  // cambia o file che esclude.
  const allDrafts = groups.flatMap((g) => g.files);
  const categorizedCount = allDrafts.filter((d) => d.categoryId).length;
  const missingCategoryCount = allDrafts.length - categorizedCount;
  const duplicateCount = allDrafts.filter((d) => d.duplicateOf).length;
  const proposedDossierCount = groups.filter(
    (g, i) => Boolean(g.existingDossier || g.proposedDossierTitle) && groupLink[i],
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/archive"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna all&apos;archivio
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand">
          Importa più file insieme
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Scegli tutti i file insieme: Hinthial li legge, li raggruppa per emittente e ti mostra
          un riepilogo, non una conferma per ciascuno.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {phase.step === "idle" ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <label className="cursor-pointer text-sm font-medium text-brand hover:underline">
            Scegli i file da importare
            <input
              type="file"
              multiple
              onChange={handleFilesPicked}
              className="sr-only"
              aria-label="Scegli i file da importare"
            />
          </label>
          {GOOGLE_DRIVE_CLIENT_ID ? (
            <>
              <span className="text-xs text-zinc-400 dark:text-zinc-600">oppure</span>
              <button
                type="button"
                onClick={() => setDriveOpen(true)}
                className="text-sm font-medium text-brand hover:underline"
              >
                📁 Importa da Google Drive
              </button>
            </>
          ) : null}
        </div>
      ) : phase.step === "reading" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sto leggendo i file… {phase.done} di {phase.total}
        </p>
      ) : phase.step === "importing" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sto importando… {phase.done} di {phase.total}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {importSource ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
                {importSource === "drive" ? "🗂️ Da Google Drive" : "💻 Dal tuo dispositivo"}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
              ✅ {categorizedCount} {categorizedCount === 1 ? "categorizzato" : "categorizzati"}
            </span>
            {missingCategoryCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                ⚠️ {missingCategoryCount} da rivedere
              </span>
            ) : null}
            {duplicateCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                🔁 {duplicateCount} possibile {duplicateCount === 1 ? "duplicato" : "duplicati"}
              </span>
            ) : null}
          </div>

          {groups.map((group, groupIndex) => {
            const hasProposal = Boolean(group.existingDossier || group.proposedDossierTitle);
            return (
              <div
                key={group.issuer ?? `senza-emittente-${groupIndex}`}
                className={
                  hasProposal
                    ? "flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4"
                    : "flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                }
              >
                {hasProposal ? (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={groupLink[groupIndex]}
                      onChange={(e) =>
                        setGroupLink((prev) =>
                          prev.map((v, i) => (i === groupIndex ? e.target.checked : v)),
                        )
                      }
                      className="mt-0.5"
                    />
                    <span>
                      {group.existingDossier ? (
                        <>
                          Questi {group.files.length}{" "}
                          {group.files.length === 1 ? "documento" : "documenti"} sembrano
                          appartenere a &laquo;{group.existingDossier.title}&raquo; (stesso
                          emittente: {group.issuer}). Aggiungerli?
                        </>
                      ) : (
                        <>
                          Questi {group.files.length} documenti hanno lo stesso emittente (
                          {group.issuer}) e sembrano la stessa vicenda. Vuoi creare il fascicolo{" "}
                          <input
                            type="text"
                            value={newDossierTitles[groupIndex]}
                            disabled={!groupLink[groupIndex]}
                            onChange={(e) =>
                              setNewDossierTitles((prev) =>
                                prev.map((v, i) => (i === groupIndex ? e.target.value : v)),
                              )
                            }
                            className="mx-1 rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-sm text-zinc-950 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                          />
                          ?
                        </>
                      )}
                    </span>
                  </label>
                ) : null}

                <ul className="flex flex-col gap-2">
                  {group.files.map((draft) => {
                    const isPdf = draft.file.type === "application/pdf";
                    const isImage = draft.file.type.startsWith("image/");
                    const missingCategory = !draft.categoryId;
                    const wasSuggested = Boolean(draft.categoryId) && draft.categoryId === draft.suggestedCategoryId;
                    return (
                      <li
                        key={draft.id}
                        className={
                          draft.duplicateOf
                            ? "flex flex-col gap-1.5 rounded-md bg-rose-50 p-2 text-sm dark:bg-rose-950/40"
                            : missingCategory
                              ? "flex flex-col gap-1.5 rounded-md bg-amber-50 p-2 text-sm dark:bg-amber-950/30"
                              : "flex flex-col gap-1.5 rounded-md bg-white p-2 text-sm dark:bg-zinc-950"
                        }
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              isPdf
                                ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-50 text-xs dark:bg-red-950"
                                : isImage
                                  ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand/10 text-xs"
                                  : "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs dark:bg-zinc-900"
                            }
                            aria-hidden="true"
                          >
                            {isImage ? "🖼️" : "📄"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-zinc-700 dark:text-zinc-300">{draft.file.name}</p>
                            {wasSuggested ? (
                              <p className="text-xs text-brand">✨ categoria suggerita dal contenuto</p>
                            ) : null}
                          </div>
                          <input
                            type="text"
                            value={draft.title}
                            onChange={(e) => updateDraft(draft.id, { title: e.target.value })}
                            placeholder="Titolo (facoltativo)"
                            aria-label={`Titolo per ${draft.file.name}`}
                            className="w-48 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                          />
                          <select
                            value={draft.categoryId}
                            onChange={(e) => updateDraft(draft.id, { categoryId: e.target.value })}
                            aria-label={`Categoria per ${draft.file.name}`}
                            className={
                              missingCategory
                                ? "rounded-md border border-amber-400 bg-white px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-zinc-950 dark:text-amber-300"
                                : "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                            }
                          >
                            <option value="">⚠️ Scegli categoria</option>
                            {sortedCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.icon} {category.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {draft.duplicateOf ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 pl-9 text-xs text-rose-700 dark:text-rose-300">
                            <span>
                              🔁 Sembra già presente in Hinthial come &laquo;{draft.duplicateOf.filename}
                              &raquo;
                              {draft.duplicateOf.createdAt
                                ? `, caricato il ${new Date(draft.duplicateOf.createdAt).toLocaleDateString("it-IT")}`
                                : " (in questo stesso lotto)"}
                              --- stesso nome, stessa dimensione.
                            </span>
                            <button
                              type="button"
                              onClick={() => excludeDraft(draft.id)}
                              className="shrink-0 font-medium underline-offset-2 hover:underline"
                            >
                              Escludi dall&apos;importazione
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {allDrafts.length} {allDrafts.length === 1 ? "file pronto" : "file pronti"}
              {proposedDossierCount > 0
                ? `, ${proposedDossierCount} ${proposedDossierCount === 1 ? "fascicolo" : "fascicoli"} proposto${proposedDossierCount === 1 ? "" : "i"}`
                : ""}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleImportAll}
                disabled={allDrafts.length === 0}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                Importa tutto
              </button>
              <Link
                href="/archive"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Annulla
              </Link>
            </div>
          </div>
        </div>
      )}

      {driveOpen && GOOGLE_DRIVE_CLIENT_ID ? (
        <GoogleDriveBrowser
          clientId={GOOGLE_DRIVE_CLIENT_ID}
          onClose={() => setDriveOpen(false)}
          onConfirm={handleGoogleDriveImported}
        />
      ) : null}
    </div>
  );
}
