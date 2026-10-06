"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PdfPageExcerpt } from "@/components/documents/PdfPageExcerpt";
import { prepareAnalysis } from "@/domain/ai/analysis/blocks";
import type { AnalysisOverview, OverviewFact } from "@/domain/ai/analysis/overview";
import {
  buildRegisterRows,
  REGISTER_GROUPS,
  registerProgress,
  type RegisterRow,
  type RegisterRowState,
} from "@/domain/ai/analysis/register";
import { splitAroundQuote } from "@/domain/ai/analysis/source";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";
import type { ContentSegment } from "@/domain/extraction/types";
import type { Proposal, ProposalKind, ProposalRejection } from "@/domain/proposals/types";
import { inferFieldInputType } from "@/domain/structured-fields/value-type";
import { sortAlphabetically } from "@/lib/utils";

/**
 * Il registro di lettura: un solo elenco al posto di "Proposte" e "Cosa ha letto Hinthia". Ogni riga è una cosa che
 * Hinthia ha trovato; accettarla la rende di sola lettura ("nella Scheda") e la restringe a una riga, così la pagina
 * si snellisce mentre si decide. Accetta, Modifica e No grazie stanno di fianco alla voce. Puramente presentazionale:
 * le chiamate (accettare, rifiutare, ripristinare) vivono in ArchiveItemDetail.tsx. Il movimento è in globals.css
 * (`.reading-*`): con "Accetta le N rimaste" le righe si accendono a onda, `--d` è il ritardo di ciascuna.
 */

export interface UndoableAction {
  message: string;
  onUndo: () => void;
}

const KIND_LABEL: Record<ProposalKind, string> = {
  expiry: "Scadenza",
  category: "Categoria",
  issuer: "Emittente",
  field: "Campo",
  event: "Da ricordare",
  asset: "Bene",
};

/** Lo stesso nome della proposta che si sta modificando: serve a chi legge lo schermo, e ai test. */
function kindLabel(proposal: Proposal): string {
  return proposal.kind === "field" ? (proposal.fieldLabel ?? KIND_LABEL.field) : KIND_LABEL[proposal.kind];
}

function primaryLabel(proposal: Proposal): string {
  if (proposal.kind === "event") return "Aggiungi a Scadenze";
  if (proposal.kind === "asset") return proposal.createAsset ? "Crea e collega" : "Collega";
  return "Accetta";
}

/** Identità di una proposta per lo stato di modifica: con più candidati dello stesso tipo, il solo tipo non dice quale. */
function rowKey(row: RegisterRow): string {
  return row.id;
}

/** Il ritardo con cui si accende una riga che passa a "nella Scheda": a onda, una ogni 150 millisecondi. */
const WAVE_STEP_MS = 150;
const JUST_CLEAR_MS = 1400;

const INPUT_CLASS =
  "w-full rounded-lg border-[1.5px] border-brand bg-white px-2.5 py-1.5 text-[15px] font-semibold text-[#121a35] outline-none focus:ring-[3px] focus:ring-brand/20 dark:bg-zinc-950 dark:text-zinc-50";
const GHOST_BUTTON =
  "reading-btn flex h-8 w-8 items-center justify-center rounded-lg border border-[#c9d0e6] bg-white text-[#121a35] hover:border-brand hover:bg-[#f1f5ff] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-brand dark:hover:bg-zinc-900";
const TEXT_GHOST_BUTTON =
  "reading-btn rounded-lg border border-[#c9d0e6] bg-white px-3 py-[7px] text-[12.5px] font-semibold text-[#121a35] hover:border-brand hover:bg-[#f1f5ff] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900";
const PRIMARY_BUTTON =
  "reading-btn reading-btn-primary whitespace-nowrap rounded-lg bg-brand px-3 py-[7px] text-[12.5px] font-bold text-white hover:bg-brand-hover disabled:opacity-50";
const LINK_BUTTON =
  "p-1 text-[12.5px] font-semibold text-[#5b6483] underline transition-colors hover:text-[#121a35] disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100";

/** Il testo del punto d'origine, evidenziato sulla frase che prova il dato. */
function SourceExcerptView({ text, quote }: { text: string; quote: string }) {
  const excerpt = splitAroundQuote(text, quote);
  const markRef = useRef<HTMLElement>(null);
  useEffect(() => {
    markRef.current?.scrollIntoView?.({ block: "center" });
  }, []);

  return (
    <div
      role="region"
      aria-label="Testo letto"
      className="max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs whitespace-pre-wrap text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
    >
      {excerpt ? (
        <>
          {excerpt.before}
          <mark ref={markRef} className="rounded bg-brand/20 px-0.5 text-inherit">
            {excerpt.match}
          </mark>
          {excerpt.after}
        </>
      ) : (
        text
      )}
    </div>
  );
}

/** Il punto d'origine di un dato: per un PDF la pagina originale con la frase evidenziata, altrimenti (o a richiesta) il testo letto. */
function FactSource({
  fact,
  text,
  loadPdfBytes,
}: {
  fact: OverviewFact;
  text: string;
  loadPdfBytes?: () => Promise<Uint8Array>;
}) {
  const [showText, setShowText] = useState(false);
  const page = fact.provenance.page;
  const excerpt = <SourceExcerptView text={text} quote={fact.quote} />;

  if (!loadPdfBytes || page === null) return excerpt;

  return (
    <div className="flex flex-col gap-1">
      {showText ? (
        excerpt
      ) : (
        <PdfPageExcerpt loadBytes={loadPdfBytes} page={page} quote={fact.quote} fallback={excerpt} />
      )}
      <button
        type="button"
        onClick={() => setShowText(!showText)}
        className="self-start text-xs text-brand underline-offset-2 hover:underline"
      >
        {showText ? "Mostra la pagina originale" : "Mostra il testo letto"}
      </button>
    </div>
  );
}

function pageLabel(row: RegisterRow): string {
  if (!row.provenance) return "";
  return row.provenance.page !== null ? `p. ${row.provenance.page}` : "nel testo";
}

export function ReadingRegister({
  overview,
  proposals,
  rejections,
  categories,
  assets,
  today,
  busy,
  segments,
  text,
  loadPdfBytes,
  onAccept,
  onReject,
  onRestore,
  acceptAllCount = 0,
  onAcceptAll,
}: {
  overview: AnalysisOverview | null;
  proposals: Proposal[];
  rejections: ProposalRejection[];
  categories: Category[];
  assets: AssetListItem[];
  /** Oggi, `YYYY-MM-DD`. */
  today: string;
  busy: boolean;
  /** Le pagine lette (null per un documento letto prima delle pagine: allora si usano le sezioni del testo). */
  segments: ContentSegment[] | null;
  text: string;
  /** Solo per un PDF: i byte del file decifrato, per mostrare la pagina originale. */
  loadPdfBytes?: () => Promise<Uint8Array>;
  /** `value` può differire da `proposal.value`: è il percorso di "Modifica". */
  onAccept: (proposal: Proposal, value: string) => void;
  onReject: (proposal: Proposal) => void;
  onRestore: (rejection: ProposalRejection) => void;
  /** Quante informazioni accetterebbe "Accetta le N rimaste" (una per tipo, senza eventi né beni). */
  acceptAllCount?: number;
  onAcceptAll?: () => void;
}) {
  const rows = useMemo(
    () => buildRegisterRows({ overview, proposals, rejections, categories, assets, today }),
    [overview, proposals, rejections, categories, assets, today],
  );
  const progress = registerProgress(rows);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [openSource, setOpenSource] = useState<string | null>(null);

  // Le righe appena passate a "nella Scheda": per qualche istante hanno il movimento, poi tornano righe normali.
  // Al primo render non si anima niente (altrimenti ogni apertura della pagina sarebbe una festa).
  const previousStates = useRef<Map<string, RegisterRowState> | null>(null);
  const [just, setJust] = useState<string[]>([]);
  useEffect(() => {
    const previous = previousStates.current;
    previousStates.current = new Map(rows.map((r) => [r.id, r.state]));
    if (!previous) return;
    const fresh = rows.filter((r) => r.state === "adopted" && previous.get(r.id) === "pending").map((r) => r.id);
    if (fresh.length === 0) return;
    setJust(fresh);
    const timer = setTimeout(() => setJust([]), JUST_CLEAR_MS + fresh.length * WAVE_STEP_MS);
    return () => clearTimeout(timer);
  }, [rows]);
  const delayOf = (id: string): number => Math.max(0, just.indexOf(id)) * WAVE_STEP_MS;

  const sourceText = useMemo(() => {
    const byId = new Map<string, string>();
    for (const segment of prepareAnalysis({ segments, text }).segments) byId.set(segment.id, segment.text);
    return byId;
  }, [segments, text]);

  const allDone = progress.pending === 0 && progress.adopted > 0;
  const tickClass = progress.adopted % 2 === 0 ? "reading-tick-a" : "reading-tick-b";

  function startEditing(row: RegisterRow) {
    if (!row.proposal) return;
    setEditing(rowKey(row));
    setDraft(row.proposal.value);
  }

  function editor(row: RegisterRow, proposal: Proposal) {
    const label = kindLabel(proposal);
    if (proposal.kind === "expiry" || proposal.kind === "event" || (proposal.kind === "field" && inferFieldInputType(proposal.value) === "date")) {
      return (
        <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`${label} da impostare`} className={INPUT_CLASS} />
      );
    }
    if (proposal.kind === "asset" && !proposal.createAsset) {
      return (
        <select value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Bene da collegare" className={INPUT_CLASS}>
          {sortAlphabetically(assets, (a) => a.name).map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))}
        </select>
      );
    }
    if (proposal.kind === "category") {
      return (
        <select value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Categoria da impostare" className={INPUT_CLASS}>
          {sortAlphabetically(categories, (c) => c.name).map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon} {category.name}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={proposal.kind === "asset" ? "Nome del bene da creare" : `${label} da impostare`}
        className={INPUT_CLASS}
      />
    );
  }

  function glyph(row: RegisterRow) {
    if (row.state === "pending") return <span className="h-3.5 w-3.5 rounded-full border-2 border-brand" aria-hidden="true" />;
    if (row.state === "adopted") {
      return (
        <span className="reading-badge flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#1c7c5a]" aria-hidden="true">
          <svg className="reading-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      );
    }
    if (row.state === "rejected") return <span className="h-0.5 w-3.5 rounded-sm bg-[#9aa1bd]" aria-hidden="true" />;
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa1bd" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }

  function actions(row: RegisterRow) {
    const proposal = row.proposal;
    const isEditing = editing === rowKey(row);

    if (isEditing && proposal) {
      return (
        <>
          <button
            type="button"
            disabled={busy || !draft}
            onClick={() => {
              setEditing(null);
              onAccept(proposal, draft);
            }}
            className={PRIMARY_BUTTON}
          >
            Salva
          </button>
          <button type="button" onClick={() => setEditing(null)} className={TEXT_GHOST_BUTTON}>
            Annulla
          </button>
        </>
      );
    }

    if (row.state === "pending" && proposal) {
      return (
        <>
          <button type="button" disabled={busy} onClick={() => onAccept(proposal, proposal.value)} className={PRIMARY_BUTTON}>
            {primaryLabel(proposal)}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => startEditing(row)}
            aria-label={`Modifica ${row.label}`}
            title="Modifica"
            className={GHOST_BUTTON}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onReject(proposal)}
            aria-label={`No, grazie: ${row.label}`}
            title="No, grazie"
            className={GHOST_BUTTON}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </>
      );
    }

    if (row.state === "adopted") {
      const canOpen = row.fact !== null && row.provenance !== null && sourceText.has(row.provenance.segmentId);
      return (
        <span className="reading-adopted-label flex items-center gap-1.5">
          <span className="text-[12.5px] font-semibold text-[#1c7c5a] dark:text-emerald-400">{row.adoptedLabel}</span>
          {canOpen ? (
            <button
              type="button"
              aria-expanded={openSource === row.id}
              aria-label={`Mostra il punto d'origine di ${row.label}`}
              onClick={() => setOpenSource(openSource === row.id ? null : row.id)}
              className="rounded-md bg-[#e8edfc] px-1.5 py-px text-[11px] font-semibold text-brand hover:underline dark:bg-brand/25 dark:text-[#9db6ff]"
            >
              {pageLabel(row)}
            </button>
          ) : null}
        </span>
      );
    }

    if (row.state === "rejected") {
      return (
        <>
          <span className="text-[12.5px] text-[#8a91ad] dark:text-zinc-500">Scartata</span>
          {row.rejection ? (
            <button type="button" disabled={busy} onClick={() => onRestore(row.rejection as ProposalRejection)} className={LINK_BUTTON}>
              Ripristina
            </button>
          ) : null}
        </>
      );
    }

    return <span className="text-[12.5px] text-[#8a91ad] dark:text-zinc-500">{row.note}</span>;
  }

  function valueCell(row: RegisterRow) {
    const isEditing = editing === rowKey(row);
    if (isEditing && row.proposal) return editor(row, row.proposal);

    const chip = pageLabel(row);
    const canOpen = row.fact !== null && row.provenance !== null && sourceText.has(row.provenance.segmentId);
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <div
          className={`reading-value truncate text-[15px] font-bold ${
            row.state === "rejected" ? "text-[#9aa1bd] line-through" : "text-[#121a35] dark:text-zinc-50"
          }`}
        >
          {row.value}
        </div>
        {row.quote ? (
          <div className="reading-quote flex min-w-0 items-center gap-1.5">
            {chip ? (
              canOpen ? (
                <button
                  type="button"
                  aria-expanded={openSource === row.id}
                  aria-label={`Mostra il punto d'origine di ${row.label}`}
                  onClick={() => setOpenSource(openSource === row.id ? null : row.id)}
                  className="shrink-0 rounded-md bg-[#e8edfc] px-1.5 py-px text-[11px] font-semibold text-brand hover:underline dark:bg-brand/25 dark:text-[#9db6ff]"
                >
                  {chip}
                </button>
              ) : (
                <span className="shrink-0 rounded-md bg-[#e8edfc] px-1.5 py-px text-[11px] font-semibold text-brand dark:bg-brand/25 dark:text-[#9db6ff]">
                  {chip}
                </span>
              )
            ) : null}
            <span className="truncate text-xs text-[#6b7391] italic dark:text-zinc-400">
              {row.fact ? <>&ldquo;{row.quote}&rdquo;</> : row.quote}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  const hasRows = rows.some((r) => r.state !== "info") || rows.length > 1;

  return (
    <section aria-label="Registro di lettura" className="flex flex-col gap-4">
      {progress.total > 0 ? (
        <div
          data-done={allDone ? "true" : "false"}
          className="reading-card flex flex-col gap-2.5 rounded-[14px] border border-[#dfe3f0] bg-white px-[18px] py-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="flex items-baseline gap-1.5 text-sm text-[#121a35] dark:text-zinc-100">
              <span className="inline-block overflow-hidden leading-[1.15]">
                <span className={`inline-block font-heading text-[22px] font-extrabold text-brand ${tickClass}`}>{progress.adopted}</span>
              </span>
              <span>
                di {progress.total} nella Scheda{" "}
                <span className="text-[#5b6483] dark:text-zinc-400">· {progress.pending} da decidere</span>
              </span>
            </p>
            {onAcceptAll && (acceptAllCount > 0 || allDone) ? (
              <button
                type="button"
                disabled={busy || allDone}
                onClick={onAcceptAll}
                aria-label={allDone ? "Tutto nella Scheda" : "Accetta tutte le voci rimaste"}
                className={`reading-btn reading-btn-primary rounded-[10px] px-4 py-[9px] text-[13px] font-bold text-white disabled:opacity-100 ${
                  allDone ? "bg-[#1c7c5a]" : "bg-brand hover:bg-brand-hover"
                }`}
              >
                {allDone ? "Tutto nella Scheda" : `Accetta le ${acceptAllCount} rimaste`}
              </button>
            ) : null}
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {rows
              .filter((r) => r.state !== "info")
              .map((row) => (
                <div
                  key={row.id}
                  className="reading-seg h-2 flex-1 rounded"
                  data-state={row.state}
                  data-just={just.includes(row.id) ? "true" : "false"}
                  style={{ "--d": `${delayOf(row.id)}ms` } as CSSProperties}
                />
              ))}
          </div>
        </div>
      ) : null}

      {hasRows ? (
        <div className="overflow-hidden rounded-[14px] border border-[#dfe3f0] bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {REGISTER_GROUPS.map((group, groupIndex) => {
            const groupRows = rows.filter((r) => r.group === group);
            if (groupRows.length === 0) return null;
            const isFirstShown = REGISTER_GROUPS.slice(0, groupIndex).every((g) => rows.every((r) => r.group !== g));
            return (
              <div key={group}>
                <h3
                  className={`bg-[#f8f9fd] px-[18px] pt-3 pb-1.5 font-heading text-[11px] font-extrabold tracking-[0.1em] text-[#5b6483] uppercase dark:bg-zinc-900 dark:text-zinc-400 ${
                    isFirstShown ? "" : "border-t border-[#dfe3f0] dark:border-zinc-800"
                  }`}
                >
                  {group}
                </h3>
                <ul>
                  {groupRows.map((row) => {
                    const isJust = just.includes(row.id);
                    const style = isJust ? ({ "--d": `${delayOf(row.id)}ms` } as CSSProperties) : undefined;
                    const isEditing = editing === rowKey(row);
                    return (
                      <li key={row.id}>
                        <div
                          className="reading-row grid grid-cols-[22px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1 sm:grid-cols-[22px_150px_minmax(0,1fr)_232px]"
                          data-state={row.state}
                          data-just={isJust ? "true" : "false"}
                          style={style}
                        >
                          <div className="row-span-3 flex h-[22px] w-[22px] items-center justify-center self-start sm:row-span-1 sm:self-center">
                            {glyph(row)}
                          </div>
                          <div className="col-start-2 text-[13px] font-medium text-[#5b6483] sm:col-start-auto dark:text-zinc-400">
                            {row.label}
                          </div>
                          <div className="col-start-2 min-w-0 sm:col-start-auto">{valueCell(row)}</div>
                          <div className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-auto sm:justify-end">
                            {actions(row)}
                          </div>
                        </div>
                        {openSource === row.id && row.fact && row.provenance && !isEditing ? (
                          <div className="border-t border-[#eef0f8] bg-[#fafbfd] px-[18px] py-3 dark:border-zinc-900 dark:bg-zinc-900/40">
                            <FactSource
                              fact={row.fact}
                              text={sourceText.get(row.provenance.segmentId) ?? ""}
                              loadPdfBytes={loadPdfBytes}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Hinthia non ha trovato dati da ricavare in questo documento.
        </p>
      )}

      <p className="text-[12.5px] text-[#6b7391] dark:text-zinc-400">
        Quello che scarti non te lo richiedo più. Ogni scelta resta in Attività. Ogni dato è stato controllato nel testo del
        documento: se la frase non c&apos;è, non compare.
        {overview?.coverage.truncated
          ? ` Il documento è molto lungo: sono state lette ${overview.coverage.read} parti su ${overview.coverage.total}.`
          : ""}
      </p>
    </section>
  );
}
