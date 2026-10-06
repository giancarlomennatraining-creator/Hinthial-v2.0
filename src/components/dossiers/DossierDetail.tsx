"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import {
  addExpectedItem,
  deleteDossier,
  deleteExpectedItem,
  listDossiers,
  listExpectedItems,
  setDossierStatus,
  setExpectedItemDone,
} from "@/domain/dossiers/repository";
import { matchExpected, type ExpectedItem } from "@/domain/dossiers/expected";
import { buildLivingTimeline, dossierOverview, formatEuro, type LivingTimelineEntry, type TimelineKind } from "@/domain/dossiers/overview";
import { createTextNote, getDocumentsByIds, listDocumentSummaries } from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listReminders } from "@/domain/reminders/repository";
import { formatDayMonthYear, relativeDay } from "@/domain/documents/archive-views";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/ToastProvider";
import type { AssetListItem } from "@/domain/assets/types";
import type { DossierListItem } from "@/domain/dossiers/types";
import type { DocumentListItem, DocumentSummary } from "@/domain/documents/types";
import type { ReminderListItem } from "@/domain/reminders/types";

/**
 * La scheda di un fascicolo: titolo, descrizione, stato, e la vicenda che racconta, tutta ricavata dai suoi documenti:
 * la cronologia (documenti, note e scadenze in un'unica linea), le prossime scadenze, le spese lette dai documenti, i
 * beni coinvolti. Niente da compilare: una sezione senza dati non compare. Chi collega un documento al fascicolo lo fa
 * dal form del documento; le note nascono qui, come note dell'Archivio collegate al fascicolo.
 */

const CARD = "flex flex-col gap-3 rounded-[18px] border border-[#dfe3f0] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950";
const CARD_TITLE = "font-heading text-base font-extrabold text-[#121a35] dark:text-zinc-100";

const ENTRY_STYLE: Record<TimelineKind, { bg: string; fg: string; icon: string }> = {
  document: { bg: "#e8edfc", fg: "#2b4fc4", icon: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z M14 3v5h5" },
  note: { bg: "#fdf3dd", fg: "#8a5a00", icon: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" },
  event: {
    bg: "#e3f4ec",
    fg: "#1c7c5a",
    icon: "M8 2v4 M16 2v4 M3 10h18 M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  },
};

const EXPENSE_COLORS = ["#2b4fc4", "#6f8ae0", "#0f8b8d", "#e0a73a", "#c9d0e6"];

const LEVEL_COLOR = { overdue: "#b42318", danger: "#b42318", warn: "#8a5a00", soft: "#5b6483", none: "#5b6483" } as const;

function TimelineRow({ entry }: { entry: LivingTimelineEntry }) {
  const style = ENTRY_STYLE[entry.kind];
  const title =
    entry.documentId !== null ? (
      <Link href={`/archive/${entry.documentId}`} className="truncate text-[14.5px] font-bold text-[#121a35] hover:text-brand dark:text-zinc-100">
        {entry.title}
      </Link>
    ) : (
      <span className="truncate text-[14.5px] font-bold text-[#121a35] dark:text-zinc-100">{entry.title}</span>
    );

  return (
    <li className="relative grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-x-3.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-[#f6f8ff] dark:hover:bg-zinc-900">
      <span
        className="absolute top-1/2 -left-[43px] -mt-3.5 box-content flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white dark:border-zinc-950"
        style={{ background: style.bg }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={style.fg} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={style.icon} />
        </svg>
      </span>
      <span className="text-[12.5px] font-bold text-[#5b6483] dark:text-zinc-400" title={entry.kind === "document" || entry.kind === "note" ? "Data di caricamento" : "Data della scadenza"}>
        {formatDayMonthYear(entry.date)}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        {title}
        {entry.detail ? <span className="text-[12.5px] text-[#5b6483] dark:text-zinc-400">{entry.detail}</span> : null}
      </span>
      {entry.expense !== null ? (
        <span className="rounded-full bg-[#e0f2f2] px-[11px] py-1 text-xs font-extrabold whitespace-nowrap text-[#0b6e70]">{formatEuro(entry.expense)}</span>
      ) : entry.completed ? (
        <span className="rounded-full bg-[#e3f4ec] px-[11px] py-1 text-xs font-extrabold text-[#1c7c5a]">Fatto</span>
      ) : null}
    </li>
  );
}

export function DossierDetail({ masterKey, dossierId }: { masterKey: CryptoKey; dossierId: string }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();

  const [dossier, setDossier] = useState<DossierListItem | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  const [now] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  // null = la tabella dei documenti attesi non c'è ancora (migrazione non applicata): il riquadro non compare.
  const [expectedItems, setExpectedItems] = useState<ExpectedItem[] | null>(null);
  const [addingExpected, setAddingExpected] = useState(false);
  const [expectedText, setExpectedText] = useState("");
  const [expectedBusy, setExpectedBusy] = useState(false);
  const [readings, setReadings] = useState<DocumentListItem[] | null>(null);
  const [readingsBusy, setReadingsBusy] = useState(false);

  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setError(null);
    try {
      const [dossiers, documentsResult, assetsResult, remindersResult, expectedResult] = await Promise.all([
        listDossiers(supabase, masterKey),
        listDocumentSummaries(supabase, masterKey),
        listAssets(supabase, masterKey),
        // Un di più: se le scadenze non si leggono, la scheda mostra comunque i documenti.
        listReminders(supabase, masterKey).catch((): ReminderListItem[] => []),
        listExpectedItems(supabase, masterKey, dossierId).catch((): null => null),
      ]);
      if (requestId !== latestRequestRef.current) return;
      setExpectedItems(expectedResult);
      setDossier(dossiers.find((d) => d.id === dossierId) ?? null);
      setDocuments(documentsResult);
      setAssets(assetsResult);
      setReminders(remindersResult);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError(err instanceof Error ? err.message : "Impossibile caricare il fascicolo.");
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [supabase, masterKey, dossierId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // "?created=1"/"?updated=1" --- stesso schema di CapsulesPanel.tsx.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  const [showUpdatedMessage] = useState(() => searchParams.get("updated") === "1");
  useEffect(() => {
    if (showCreatedMessage) showToast("Fascicolo creato.");
    if (showUpdatedMessage) showToast("Fascicolo aggiornato.");
    if (showCreatedMessage || showUpdatedMessage) router.replace(`/dossiers/${dossierId}`);
  }, [showCreatedMessage, showUpdatedMessage, router, showToast, dossierId]);

  async function handleToggleStatus() {
    if (!dossier) return;
    setBusy(true);
    setError(null);
    try {
      const next = dossier.status === "open" ? "closed" : "open";
      await setDossierStatus(supabase, dossierId, next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare lo stato.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!dossier) return;
    if (
      !window.confirm(
        `Eliminare il fascicolo "${dossier.title}"? I documenti collegati non verranno eliminati, solo scollegati.`,
      )
    )
      return;

    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await deleteDossier(supabase, user.id, dossierId);
      router.push("/dossiers?deleted=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il fascicolo.");
      setBusy(false);
    }
  }

  /** Una nota è una nota dell'Archivio collegata al fascicolo: niente di nuovo da gestire, e si ritrova anche in Archivio. */
  async function handleAddNote() {
    const text = noteText.trim();
    if (!text) return;
    setNoteBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      const title = text.split("\n")[0].slice(0, 60);
      await createTextNote(supabase, masterKey, user.id, { title, body: text }, {
        categoryId: null,
        relatedAssetId: null,
        dossierIds: [dossierId],
        expiresAt: null,
        notes: "",
        tags: [],
        issuer: "",
      });
      setNoteText("");
      await refresh();
      showToast("Nota aggiunta.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiungere la nota.");
    } finally {
      setNoteBusy(false);
    }
  }

  /** Aggiunge una o più voci: più nomi separati da virgola o a capo diventano più voci. */
  async function handleAddExpected() {
    const labels = expectedText
      .split(/[,\n]/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (labels.length === 0) return;
    setExpectedBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      for (const label of labels) await addExpectedItem(supabase, masterKey, user.id, dossierId, label);
      setExpectedText("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiungere il documento atteso.");
    } finally {
      setExpectedBusy(false);
    }
  }

  async function handleExpectedAction(action: () => Promise<void>) {
    setExpectedBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare i documenti attesi.");
    } finally {
      setExpectedBusy(false);
    }
  }

  /** Le sintesi sono già nei documenti letti da Hinthia: si leggono solo quando le chiedi, e nessuna nuova lettura parte. */
  async function handleShowReadings(ids: string[]) {
    setReadingsBusy(true);
    setError(null);
    try {
      setReadings(await getDocumentsByIds(supabase, masterKey, ids));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile leggere i documenti.");
    } finally {
      setReadingsBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  if (!dossier) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/dossiers"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna ai fascicoli
        </Link>
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Fascicolo non trovato.
        </p>
      </div>
    );
  }

  const linkedDocuments = documents.filter((doc) => doc.dossierIds.includes(dossierId));
  const overview = dossierOverview({ documents: linkedDocuments, reminders, assets, now });
  const timeline = buildLivingTimeline(linkedDocuments, reminders);
  const expected = expectedItems ? matchExpected(expectedItems, linkedDocuments) : null;
  const isClosed = dossier.status === "closed";
  const expenses = overview.expenses;
  const expenseSlices = expenses
    ? [...expenses.items.slice(0, 4), ...(expenses.items.length > 4 ? [{ docId: "rest", filename: "Altro", label: "", amount: expenses.items.slice(4).reduce((s, i) => s + i.amount, 0) }] : [])]
    : [];

  return (
    <div className="flex flex-col gap-6 text-[#121a35] dark:text-zinc-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link
            href="/dossiers"
            className="self-start text-[13.5px] font-bold text-brand underline-offset-2 hover:underline"
          >
            ← Torna ai fascicoli
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#e8edfc] dark:bg-brand/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2b4fc4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              </svg>
            </span>
            <h1 className="min-w-0 font-heading text-[30px] leading-tight font-extrabold tracking-[-0.02em] break-words text-brand">{dossier.title}</h1>
            <span
              className={`rounded-full px-[11px] py-1 text-[12.5px] font-bold ${
                isClosed ? "bg-[#eceff4] text-[#5b6483] dark:bg-zinc-800 dark:text-zinc-300" : "bg-[#e8edfc] text-brand dark:bg-brand/20 dark:text-[#9db6ff]"
              }`}
            >
              {isClosed ? "Chiuso" : "Aperto"}
            </span>
          </div>
          <p className="text-[13.5px] text-[#5b6483] dark:text-zinc-400">
            {isClosed ? `Chiuso il ${formatDate(dossier.closedAt!)}` : "Aperto"} · creato il {formatDate(dossier.createdAt)} ·{" "}
            {overview.documentCount} {overview.documentCount === 1 ? "documento" : "documenti"}
            {overview.lastUpdate ? ` · ultimo ${relativeDay(overview.lastUpdate, now)}` : ""}
          </p>
          {dossier.description ? (
            <p className="max-w-3xl text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{dossier.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href={`/dossiers/${dossierId}/edit`}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            Modifica
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={handleToggleStatus}
            className="rounded-xl border-[1.5px] border-[#c9d0e6] bg-white px-4 py-2 text-sm font-semibold text-[#121a35] hover:border-brand disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {isClosed ? "Riapri fascicolo" : "Chiudi fascicolo"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="rounded-xl border-[1.5px] border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-950"
          >
            Elimina
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start">
        <section
          aria-label="Cronologia"
          className="flex min-w-0 flex-1 flex-col gap-3.5 rounded-[18px] border border-[#dfe3f0] bg-white px-5 py-[18px] dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h2 className={CARD_TITLE}>Cronologia</h2>

          <div className="flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddNote();
              }}
              placeholder="Scrivi una nota su questa vicenda…"
              aria-label="Scrivi una nota"
              className="min-w-0 flex-1 rounded-xl border-[1.5px] border-[#dfe3f0] bg-white px-3.5 py-2.5 text-sm text-[#121a35] outline-none focus:border-brand dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="button"
              disabled={noteBusy || !noteText.trim()}
              onClick={() => void handleAddNote()}
              className="rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              Aggiungi nota
            </button>
          </div>

          {timeline.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessun documento collegato. Aprine uno in Archivio e scegli questo fascicolo dal campo
              &laquo;Fascicolo&raquo;.
            </p>
          ) : (
            <ul className="ml-[17px] flex flex-col border-l-2 border-[#dfe3f0] pl-6 dark:border-zinc-800">
              {timeline.map((entry) => (
                <TimelineRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </section>

        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
          {expected && (expected.total > 0 || addingExpected) ? (
            <section aria-label="Documenti attesi" className={CARD}>
              <div className="flex items-baseline justify-between">
                <h2 className={CARD_TITLE}>Documenti attesi</h2>
                {expected.total > 0 ? (
                  <span className="text-xs font-bold text-[#5b6483] dark:text-zinc-400">
                    {expected.done} di {expected.total}
                  </span>
                ) : null}
              </div>
              {expected.total > 0 ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-[#eef0f8] dark:bg-zinc-900" aria-hidden="true">
                  <span className="block h-full rounded-full bg-[#1c7c5a]" style={{ width: `${(expected.done / expected.total) * 100}%` }} />
                </div>
              ) : null}
              <ul className="flex flex-col">
                {expected.statuses.map((status) => (
                  <li key={status.item.id} className="group flex items-start gap-2.5 border-t border-[#eef0f8] py-2 first:border-t-0 first:pt-0 dark:border-zinc-900">
                    <input
                      type="checkbox"
                      checked={status.satisfied}
                      // Una voce abbinata a un documento non si disattiva da qui: toglierla è un'altra cosa.
                      disabled={expectedBusy || status.documentId !== null}
                      onChange={(e) => {
                        // Subito, senza aspettare la rete: la spunta deve rispondere al clic.
                        const checked = e.target.checked;
                        setExpectedItems((items) => items?.map((i) => (i.id === status.item.id ? { ...i, done: checked } : i)) ?? items);
                        void handleExpectedAction(() => setExpectedItemDone(supabase, status.item.id, checked));
                      }}
                      aria-label={`${status.item.label}: fatto`}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#1c7c5a]"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={`text-sm leading-snug font-semibold ${status.satisfied ? "text-[#5b6483] line-through dark:text-zinc-500" : ""}`}>
                        {status.item.label}
                      </span>
                      {status.documentId ? (
                        <Link href={`/archive/${status.documentId}`} className="truncate text-xs font-bold text-[#1c7c5a] hover:underline">
                          {status.documentName}
                        </Link>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      disabled={expectedBusy}
                      onClick={() => void handleExpectedAction(() => deleteExpectedItem(supabase, status.item.id))}
                      aria-label={`Togli ${status.item.label}`}
                      className="shrink-0 rounded-md px-1.5 text-base leading-none text-[#8a91ad] hover:text-red-600 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={expectedText}
                  onChange={(e) => setExpectedText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleAddExpected();
                  }}
                  placeholder="Referto, fattura…"
                  aria-label="Aggiungi un documento atteso"
                  className="min-w-0 flex-1 rounded-[10px] border-[1.5px] border-[#dfe3f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-brand dark:border-zinc-800 dark:bg-zinc-950"
                />
                <button
                  type="button"
                  disabled={expectedBusy || !expectedText.trim()}
                  onClick={() => void handleAddExpected()}
                  className="rounded-[10px] border border-[#c9d0e6] bg-white px-3 py-2 text-[13px] font-bold text-brand hover:border-brand disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  Aggiungi
                </button>
              </div>
              <p className="text-[11.5px] leading-snug text-[#8a91ad] dark:text-zinc-500">
                Una voce si spunta da sola quando nel fascicolo c&apos;è un documento che la nomina.
              </p>
            </section>
          ) : expected && !isClosed ? (
            <button
              type="button"
              onClick={() => setAddingExpected(true)}
              className="self-start rounded-xl border-[1.5px] border-dashed border-[#c9d0e6] px-3.5 py-2 text-[13px] font-bold text-brand hover:border-brand dark:border-zinc-700"
            >
              + Documenti attesi
            </button>
          ) : null}

          {overview.deadlines.length > 0 ? (
            <section aria-label="Prossime scadenze" className={CARD}>
              <h2 className={CARD_TITLE}>Prossime scadenze</h2>
              <ul className="flex flex-col">
                {overview.deadlines.slice(0, 5).map((deadline) => (
                  <li key={`${deadline.kind}-${deadline.id}`} className="flex flex-col gap-0.5 border-t border-[#eef0f8] py-2.5 first:border-t-0 first:pt-0 dark:border-zinc-900">
                    <span className="text-sm leading-snug font-semibold">{deadline.title}</span>
                    <span className="text-xs font-bold" style={{ color: LEVEL_COLOR[deadline.info.level] }}>
                      {formatDayMonthYear(deadline.date)} · {deadline.info.text.replace("scade ", "")}
                    </span>
                  </li>
                ))}
              </ul>
              {overview.deadlines.length > 5 ? (
                <p className="text-xs text-[#5b6483] dark:text-zinc-400">e altre {overview.deadlines.length - 5}</p>
              ) : null}
            </section>
          ) : null}

          {expenses ? (
            <section aria-label="Spese" className={CARD}>
              <div className="flex items-baseline justify-between">
                <h2 className={CARD_TITLE}>Spese</h2>
                <span className="font-heading text-xl font-extrabold text-brand">{formatEuro(expenses.total)}</span>
              </div>
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]" aria-hidden="true">
                {expenseSlices.map((slice, i) => (
                  <span key={slice.docId} style={{ flex: slice.amount, background: EXPENSE_COLORS[i] }} />
                ))}
              </div>
              <ul className="flex flex-col gap-1.5">
                {expenseSlices.map((slice, i) => (
                  <li key={slice.docId} className="flex items-center gap-2 text-[13px]">
                    <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: EXPENSE_COLORS[i] }} />
                    <span className="min-w-0 flex-1 truncate text-[#3d4670] dark:text-zinc-300">{slice.filename.replace(/\.[a-z0-9]{2,5}$/i, "")}</span>
                    <span className="font-bold">{formatEuro(slice.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11.5px] leading-snug text-[#8a91ad] dark:text-zinc-500">
                Le cifre vengono dagli importi letti nei documenti del fascicolo.
              </p>
            </section>
          ) : null}

          {overview.assets.length > 0 ? (
            <section aria-label="Coinvolti" className={CARD}>
              <h2 className={CARD_TITLE}>Coinvolti</h2>
              <ul className="flex flex-col gap-2.5">
                {overview.assets.map((asset) => (
                  <li key={asset.id} className="flex items-center gap-2.5">
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#e0f2f2]">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0f8b8d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 11l9-8 9 8" />
                        <path d="M5 10v10h14V10" />
                      </svg>
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <Link href="/assets" className="truncate text-[13.5px] font-bold hover:text-brand">
                        {asset.name}
                      </Link>
                      <span className="text-xs text-[#5b6483] dark:text-zinc-400">
                        Bene · {asset.count} {asset.count === 1 ? "documento" : "documenti"} in questo fascicolo
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {linkedDocuments.length > 0 ? (
            <section aria-label="Cosa dicono i documenti" className={CARD}>
              <h2 className={CARD_TITLE}>Cosa dicono i documenti</h2>
              {readings === null ? (
                <>
                  <p className="text-[13px] leading-snug text-[#5b6483] dark:text-zinc-400">
                    Le sintesi che Hinthia ha già scritto leggendo i documenti: nessuna nuova lettura parte.
                  </p>
                  <button
                    type="button"
                    disabled={readingsBusy}
                    onClick={() => void handleShowReadings(linkedDocuments.map((d) => d.id))}
                    className="self-start rounded-[10px] border border-[#c9d0e6] bg-white px-3 py-2 text-[13px] font-bold text-brand hover:border-brand disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    {readingsBusy ? "Leggo…" : "Mostra le sintesi"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-[#5b6483] dark:text-zinc-400">
                    {readings.filter((d) => d.aiSynthesis).length} di {readings.length} documenti letti da Hinthia
                  </p>
                  <ul className="flex flex-col gap-3">
                    {readings
                      .filter((d) => d.aiSynthesis)
                      .map((d) => (
                        <li key={d.id} className="flex flex-col gap-0.5">
                          <Link href={`/archive/${d.id}`} className="truncate text-[13px] font-bold hover:text-brand">
                            {d.filename}
                          </Link>
                          <span className="line-clamp-4 text-[13px] leading-snug text-[#3d4670] dark:text-zinc-300">{d.aiSynthesis}</span>
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
