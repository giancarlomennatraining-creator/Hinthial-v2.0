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
import { sortAlphabetically } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import type { Category } from "@/domain/categories/types";
import type { DocumentMetadataInput } from "@/domain/documents/types";

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

  async function handleFilesPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setError(null);

    setPhase({ step: "reading", done: 0, total: files.length });

    // Uno alla volta, non in parallelo --- ognuno richiede di leggere il
    // file e, per i tipi che lo prevedono, farlo passare per l'OCR: farne
    // partire dieci insieme su un telefono lo farebbe solo arrancare
    // (stessa scelta già fatta per il recupero dei contenuti storici, v.
    // FASE 17b).
    const read: DraftFile[] = [];
    for (const [index, file] of files.entries()) {
      const mimeType = file.type || "application/octet-stream";
      let text: string | null = null;
      if (canExtractText(mimeType)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        text = await extractText(bytes, mimeType);
      }
      read.push({ id: crypto.randomUUID(), file, text, title: "", categoryId: "" });
      setPhase({ step: "reading", done: index + 1, total: files.length });
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
        if (!draft.text) continue;
        const suggestion = heuristicCategorizer.suggestCategoryFromContent(
          draft.file.name,
          draft.text,
          categoriesResult,
        );
        if (suggestion) draft.categoryId = suggestion;

        const title = extractStructuredFields(draft.text).find((f) => f.kind === "title")?.value;
        if (title) draft.title = title;
      }

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

  function updateDraft(id: string, patch: Partial<Pick<DraftFile, "title" | "categoryId">>) {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        files: group.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      })),
    );
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
            dossierId,
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
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
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
                  {group.files.map((draft) => (
                    <li
                      key={draft.id}
                      className="flex flex-wrap items-center gap-2 rounded-md bg-white p-2 text-sm dark:bg-zinc-950"
                    >
                      <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                        📄 {draft.file.name}
                      </span>
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
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                      >
                        <option value="">Nessuna categoria</option>
                        {sortedCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.icon} {category.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleImportAll}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
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
      )}
    </div>
  );
}
