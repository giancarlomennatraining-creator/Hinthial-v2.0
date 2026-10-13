"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  getDocumentById,
  listAssetLinkedFields,
  saveAISynthesis,
  saveContentAnalysis,
} from "@/domain/documents/repository";
import { loadDocumentSegments } from "@/domain/documents/segments";
import { removePendingConfirmation } from "@/domain/documents/pending-confirmation";
import { listAssets } from "@/domain/assets/repository";
import type { LinkedDocumentFields } from "@/domain/assets/link-proposal";
import type { AssetListItem } from "@/domain/assets/types";
import { listCategories } from "@/domain/categories/repository";
import { isCategoryEnabledForExtraction } from "@/domain/categories/ai-consent";
import { listTypeCategoryOverrides } from "@/domain/categories/type-categories";
import type { Category } from "@/domain/categories/types";
import type { TypeCategoryOverrides } from "@/domain/ai/analysis/category-defaults";
import { AnalysisAbortedError, analyzeDocumentWithClaude, type AIAnalysisScope, type AnalysisProgress } from "@/domain/ai/analyze-document";
import { readingStateFor } from "@/domain/extraction/reading-state";
import {
  acceptProposal,
  listProposalRejections,
  rejectProposal,
  undoAcceptance,
  type AcceptedProposal,
} from "@/domain/proposals/repository";
import { onePerSlot, proposalsForDocument } from "@/domain/proposals/for-document";
import type { Proposal, ProposalRejection } from "@/domain/proposals/types";
import { listDocumentReminderDates, localDateKey } from "@/domain/reminders/repository";
import type { DocumentListItem } from "@/domain/documents/types";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { Spinner } from "@/components/ui/Spinner";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/ui/styles";
import { contentKindFor, CONTENT_KIND_ICON } from "@/lib/content-kind";
import { formatDate } from "@/lib/format";

/** Un documento importato, con tutto ciò che serve per calcolarne le proposte (v. proposalsForDocument). */
interface Item {
  doc: DocumentListItem;
  rejections: ProposalRejection[];
  reminderDates: string[];
  linkedFields: LinkedDocumentFields[];
}

/** Cosa propone una proposta, a parole: "Scadenza del documento: 12 marzo 2027". */
function proposalLabel(proposal: Proposal, categories: Category[], assets: AssetListItem[]): string {
  switch (proposal.kind) {
    case "expiry":
      return `Scadenza del documento: ${formatDate(proposal.value)}`;
    case "issuer":
      return `Emittente: ${proposal.value}`;
    case "category": {
      const category = categories.find((c) => c.id === proposal.value);
      return `Categoria: ${category ? `${category.icon} ${category.name}` : proposal.value}`;
    }
    case "field":
      return `${proposal.fieldLabel ?? "Campo"}: ${proposal.value}`;
    case "event":
      return `Da ricordare: ${proposal.eventTitle ?? "evento"}, ${formatDate(proposal.value)}`;
    case "asset":
      return proposal.createAsset
        ? `Crea il bene «${proposal.value}» e collegalo`
        : `Collega al bene «${assets.find((a) => a.id === proposal.value)?.name ?? "un bene"}»`;
  }
}

function proposalKey(proposal: Proposal): string {
  return `${proposal.kind}:${proposal.fieldKey ?? ""}:${proposal.value}`;
}

/**
 * La conferma dopo aver importato più documenti (flusso "Arriva un documento", fase 3). Una scheda per documento con ciò che
 * Hinthia ne ha capito e un Sì / No su ogni proposta, e in cima i gesti che valgono per tutti: far leggere i documenti a
 * Hinthia con una sola conferma, e accettare in blocco le proposte sicure. Le proposte nascono solo dalla lettura di Hinthia
 * (che manda il testo a Claude): si parte sempre da una conferma esplicita, mai da sola, e le regole di consenso sono quelle
 * della scheda del documento. Nulla si scrive senza un sì.
 */
export function ConfirmImport({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { masterEnabled, extractionConsent } = useAIProcessingConsent();
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const idsKey = ids.join(",");

  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [typeCategories, setTypeCategories] = useState<TypeCategoryOverrides>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(() => localDateKey(new Date().toISOString()));
  const [busyId, setBusyId] = useState<string | null>(null);
  // La lettura di gruppo: quale documento è in corso (da 1), quanti sono, e a che punto è quello (parti di un documento lungo).
  const [reading, setReading] = useState<{ current: number; total: number; progress: AnalysisProgress | null } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // L'ultima accettazione in blocco, per poterla annullare.
  const [lastBulk, setLastBulk] = useState<{ docId: string; accepted: AcceptedProposal }[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadItem = useCallback(
    async (id: string): Promise<Item | null> => {
      const doc = await getDocumentById(supabase, masterKey, id);
      if (!doc) return null;
      const [rejections, reminderDates, linkedFields] = await Promise.all([
        listProposalRejections(supabase, masterKey, id),
        listDocumentReminderDates(supabase, id),
        // Un suggerimento in più: se non si legge, la schermata funziona lo stesso, solo senza la proposta del bene.
        listAssetLinkedFields(supabase, masterKey, id).catch((): LinkedDocumentFields[] => []),
      ]);
      return { doc, rejections, reminderDates, linkedFields };
    },
    [supabase, masterKey],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const [loaded, categoriesResult, assetsResult, typeCategoriesResult] = await Promise.all([
          Promise.all(idsKey.split(",").filter(Boolean).map((id) => loadItem(id))),
          listCategories(supabase),
          listAssets(supabase, masterKey),
          listTypeCategoryOverrides(supabase).catch((): TypeCategoryOverrides => ({})),
        ]);
        if (cancelled) return;
        setUserId(user?.id ?? null);
        setItems(loaded.filter((item): item is Item => item !== null));
        setCategories(categoriesResult);
        setAssets(assetsResult);
        setTypeCategories(typeCategoriesResult);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossibile caricare i documenti.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, masterKey, idsKey, loadItem]);

  async function reloadItem(id: string) {
    const next = await loadItem(id);
    setItems((prev) => prev.map((item) => (item.doc.id === id ? (next ?? item) : item)));
    // Un'azione cambia le proposte di un documento e, creando un bene, quelle degli altri: i beni si rileggono.
    setAssets(await listAssets(supabase, masterKey));
  }

  const proposalsOf = (item: Item) =>
    proposalsForDocument({ doc: item.doc, categories, typeCategories, assets, linkedFields: item.linkedFields, rejections: item.rejections, reminderDates: item.reminderDates, today }).proposals;

  /** Ogni azione su una proposta passa di qui: esegue, ricarica quel documento, mostra l'errore se c'è. */
  async function runAction(docId: string, action: (ownerId: string) => Promise<void>) {
    setBusyId(docId);
    setError(null);
    setNotice(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await action(user.id);
      await reloadItem(docId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile applicare la proposta.");
    } finally {
      setBusyId(null);
    }
  }

  function handleAccept(item: Item, proposal: Proposal) {
    setLastBulk(null);
    void runAction(item.doc.id, async (ownerId) => {
      await acceptProposal(supabase, masterKey, ownerId, item.doc, proposal, proposal.value);
    });
  }

  function handleReject(item: Item, proposal: Proposal) {
    setLastBulk(null);
    void runAction(item.doc.id, async (ownerId) => {
      await rejectProposal(supabase, masterKey, ownerId, item.doc.id, proposal);
    });
  }

  // I documenti che Hinthia può ancora leggere: testo letto sul dispositivo, nessuna lettura salvata, non esclusi dall'analisi.
  const readable = items.filter((item) => !item.doc.contentAnalysis && readingStateFor(item.doc) === "text" && !item.doc.aiExtractionExcluded);
  const consentActive = masterEnabled && extractionConsent;
  const sure = items.map((item) => ({ item, proposals: onePerSlot(proposalsOf(item)) })).filter((entry) => entry.proposals.length > 0);
  const sureCount = sure.reduce((sum, entry) => sum + entry.proposals.length, 0);

  /** Hinthia legge i documenti uno dopo l'altro, con una sola conferma in cima: dice chi sono e che il testo esce dal dispositivo. */
  async function handleReadAll() {
    if (readable.length === 0 || reading) return;
    const list = readable.slice(0, 8).map((item) => `• ${item.doc.filename}`).join("\n");
    const more = readable.length > 8 ? `\n… e altri ${readable.length - 8}` : "";
    const confirmed = window.confirm(
      `Il testo di ${readable.length} ${readable.length === 1 ? "documento verrà inviato" : "documenti verrà inviato"} a Hinthia, uno dopo l'altro:\n\n${list}${more}\n\nUn contenuto uscito è uscito. Continuare?`,
    );
    if (!confirmed) return;

    const abort = new AbortController();
    abortRef.current = abort;
    setError(null);
    setNotice(null);
    const failures: string[] = [];
    let done = 0;
    try {
      for (const [index, item] of readable.entries()) {
        setReading({ current: index + 1, total: readable.length, progress: null });
        const { doc } = item;
        try {
          const segments = await loadDocumentSegments(supabase, masterKey, doc).catch(() => null);
          const category = categories.find((c) => c.id === doc.categoryId);
          // Con la categoria già abilitata vale quella; altrimenti "solo questa volta", coperto dalla conferma di sopra.
          const scope: AIAnalysisScope = category && isCategoryEnabledForExtraction(category) ? "category" : "once";
          const fields = await analyzeDocumentWithClaude(doc, categories, scope, {
            segments,
            onProgress: (progress) => setReading({ current: index + 1, total: readable.length, progress }),
            signal: abort.signal,
            persistence: {
              masterKey,
              saved: doc.contentAnalysis,
              save: (analysis, status) => saveContentAnalysis(supabase, masterKey, doc.id, analysis, status),
            },
          });
          if (fields.synthesis) await saveAISynthesis(supabase, masterKey, doc.id, fields.synthesis);
          await reloadItem(doc.id);
          done++;
        } catch (err) {
          if (err instanceof AnalysisAbortedError) break;
          failures.push(doc.filename);
          await reloadItem(doc.id).catch(() => undefined);
        }
      }
    } finally {
      abortRef.current = null;
      setReading(null);
    }
    if (failures.length > 0) {
      setError(`Hinthia non è riuscita a leggere: ${failures.join(", ")}. Si può riprovare dalla scheda del documento.`);
    } else if (done > 0) {
      setNotice(done === 1 ? "Hinthia ha letto 1 documento." : `Hinthia ha letto ${done} documenti.`);
    }
  }

  /** Una sola proposta per tipo e per documento (v. onePerSlot): quelle sicure si accettano insieme, e insieme si annullano. */
  async function handleAcceptSure() {
    if (sureCount === 0) return;
    setError(null);
    setNotice(null);
    setBusyId("all");
    const accepted: { docId: string; accepted: AcceptedProposal }[] = [];
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      try {
        for (const entry of sure) {
          for (const proposal of entry.proposals) {
            accepted.push({
              docId: entry.item.doc.id,
              accepted: await acceptProposal(supabase, masterKey, user.id, entry.item.doc, proposal, proposal.value),
            });
          }
        }
      } finally {
        // Anche a metà strada si ricarica: quel che è stato scritto resta, e si può annullare.
        if (accepted.length > 0) {
          await Promise.all([...new Set(accepted.map((a) => a.docId))].map((id) => reloadItem(id)));
          setLastBulk(accepted);
        }
      }
      setNotice(accepted.length === 1 ? "1 informazione aggiunta." : `${accepted.length} informazioni aggiunte ai documenti.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile accettare le proposte.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndoBulk() {
    if (!lastBulk) return;
    setBusyId("all");
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      for (const entry of [...lastBulk].reverse()) {
        await undoAcceptance(supabase, masterKey, user.id, entry.docId, entry.accepted);
      }
      await Promise.all([...new Set(lastBulk.map((a) => a.docId))].map((id) => reloadItem(id)));
      setLastBulk(null);
      setNotice("Annullato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile annullare.");
    } finally {
      setBusyId(null);
    }
  }

  function finish(clear: boolean) {
    if (clear && userId) removePendingConfirmation(userId, ids);
    router.push("/archive");
  }

  const working = busyId !== null || reading !== null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/archive" className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400">
          ← Torna all&apos;archivio
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand">
          {items.length === 1 ? "1 documento da confermare" : `${items.length} documenti da confermare`}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Sono già nel tuo Archivio, cifrati sul dispositivo. Qui decidi cosa tenere di ciò che Hinthia ne ricava: nulla si scrive senza un tuo sì.
        </p>
      </div>

      {loading ? <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p> : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="flex flex-wrap items-center gap-3 text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
          {lastBulk ? (
            <button type="button" onClick={() => void handleUndoBulk()} disabled={working} className="font-semibold underline underline-offset-2 disabled:opacity-50">
              Annulla
            </button>
          ) : null}
        </p>
      ) : null}

      {!loading && items.length === 0 && !error ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Non trovo i documenti da confermare: forse sono già stati sistemati o eliminati.</p>
      ) : null}

      {items.length > 0 ? (
        <section aria-label="Cosa può fare Hinthia" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
          {reading ? (
            <div role="status" aria-live="polite" className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <Spinner />
                Hinthia sta leggendo il documento {reading.current} di {reading.total}
                {reading.progress && reading.progress.total >= 2
                  ? ` (parte ${Math.min(reading.progress.current, reading.progress.total)} di ${reading.progress.total})`
                  : ""}
                …
              </p>
              <button type="button" onClick={() => abortRef.current?.abort()} className={`${BTN_SECONDARY} w-fit`}>
                Interrompi
              </button>
            </div>
          ) : !consentActive ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              La lettura con Hinthia non è attiva: attivala in{" "}
              <Link href="/settings" className="underline underline-offset-2 hover:text-brand">
                Impostazioni → Hinthia
              </Link>{" "}
              per avere le proposte. Intanto puoi aprire ogni documento e sistemarlo a mano.
            </p>
          ) : readable.length > 0 ? (
            <>
              <button type="button" disabled={working} onClick={() => void handleReadAll()} className={`${BTN_PRIMARY} w-fit disabled:opacity-50`}>
                Chiedi a Hinthia di leggere {readable.length === 1 ? "questo documento" : `questi ${readable.length} documenti`}
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Il testo parte solo dopo la tua conferma, e solo per i documenti elencati. Rimangono esclusi quelli senza testo letto o esclusi dall&apos;analisi.
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Non c&apos;è altro da far leggere a Hinthia.</p>
          )}

          {sureCount > 0 ? (
            <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-900">
              <button type="button" disabled={working} onClick={() => void handleAcceptSure()} className={`${BTN_PRIMARY} w-fit disabled:opacity-50`}>
                Accetta le {sureCount} proposte sicure
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Una per tipo e per documento (scadenza, emittente, categoria, campi). Le date da ricordare e il collegamento a un bene si confermano una per una.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const { doc } = item;
          const kind = contentKindFor(doc.mimeType);
          const proposals = proposalsOf(item);
          const state = readingStateFor(doc);
          const sureKeys = new Set(onePerSlot(proposals).map(proposalKey));
          const rowBusy = busyId === doc.id || busyId === "all";
          return (
            <li key={doc.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_2px_8px_rgba(18,26,53,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden="true">{CONTENT_KIND_ICON[kind]}</span>
                <Link href={`/archive/${doc.id}`} className="min-w-0 break-words text-sm font-semibold text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100">
                  {doc.filename}
                </Link>
                {doc.contentAnalysis ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Letto da Hinthia</span>
                ) : doc.aiExtractionExcluded ? (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">Escluso dall&apos;analisi</span>
                ) : state === "text" ? (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">Testo letto sul dispositivo</span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">Niente testo da leggere</span>
                )}
              </div>

              {proposals.length > 0 ? (
                <ul className="flex flex-col gap-2" aria-label={`Proposte per ${doc.filename}`}>
                  {proposals.map((proposal) => {
                    const isSure = sureKeys.has(proposalKey(proposal));
                    const label = proposalLabel(proposal, categories, assets);
                    return (
                      <li key={proposalKey(proposal)} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {proposal.source ? `“${proposal.source}”` : ""}
                            {proposal.page ? ` · pagina ${proposal.page}` : ""}
                            {isSure ? "" : " · da confermare a parte"}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={rowBusy || working}
                          onClick={() => handleAccept(item, proposal)}
                          aria-label={`Sì: ${label}`}
                          className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                        >
                          Sì
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy || working}
                          onClick={() => handleReject(item, proposal)}
                          aria-label={`No: ${label}`}
                          className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        >
                          No
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : doc.contentAnalysis ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessuna proposta da decidere: tutto già sistemato, o Hinthia non ha trovato altro.</p>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessuna proposta, per ora: compaiono dopo la lettura di Hinthia.</p>
              )}
            </li>
          );
        })}
      </ul>

      {items.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" disabled={working} onClick={() => finish(true)} className={`${BTN_PRIMARY} w-full sm:w-auto disabled:opacity-50`}>
            Ho finito
          </button>
          <button type="button" disabled={working} onClick={() => finish(false)} className={`${BTN_SECONDARY} w-full sm:w-auto disabled:opacity-50`}>
            Più tardi
          </button>
        </div>
      ) : null}
    </div>
  );
}
