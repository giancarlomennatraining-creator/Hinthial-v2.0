"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArchiveViewSwitcher } from "@/components/documents/archive/ArchiveViewSwitcher";
import { AddContentMenu, DrawnPage, ExpiryPill } from "@/components/documents/archive/parts";
import { useThumbnail } from "@/components/documents/archive/thumbnails";
import type { ArchiveData } from "@/components/documents/archive/useArchiveData";
import {
  categoryColor,
  categoryShade,
  expiryInfo,
  formatDayMonthYear,
  isReadByHinthia,
  layoutShelf,
  matchesQuery,
  needsAttention,
  SHELF_COLUMNS,
  UNCATEGORIZED_COLOR,
  UNCATEGORIZED_NAME,
  type Spine,
} from "@/domain/documents/archive-views";
import type { DocumentSummary } from "@/domain/documents/types";
import { cn } from "@/lib/utils";

/**
 * Vista "Scaffale": ogni documento è un dorso. Il colore è la categoria, l'altezza il peso del file, il nastrino in cima
 * una scadenza vicina, il puntino in basso che Hinthia l'ha letto. I filtri non nascondono: illuminano, abbassando gli
 * altri dorsi.
 */

type Filter = null | "__expiring" | "__unread" | string;

const SHELF_ROW_HEIGHT = 176;
const DIMMED_OPACITY = 0.2;

function SelectedPreview({ doc, color }: { doc: DocumentSummary; color: string }) {
  const { url, ref } = useThumbnail(doc);
  return (
    <div ref={ref} className="h-[190px] rounded-xl bg-[#eef1f9] px-10 pt-4 dark:bg-zinc-900">
      <div className="h-full overflow-hidden rounded-t bg-white shadow-[0_1px_3px_rgba(18,26,53,0.14)]">
        {url ? (
          <>
            <div style={{ height: 20, background: color }} />
            {/* eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo */}
            <img src={url} alt="" className="h-full w-full object-cover object-top" />
          </>
        ) : (
          <DrawnPage color={color} headerHeight={20} lines={[80, 55, 90, 45]} lineHeight={6} gap={8} padding="12px 14px" />
        )}
      </div>
    </div>
  );
}

export function ShelfView({ data }: { data: ArchiveData }) {
  const { documents, categories, assets, handleOpen, busyDocId } = data;
  const [now] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const shelves = useMemo(() => layoutShelf(documents), [documents]);
  const onShelf = useMemo(() => shelves.flatMap((s) => s.spines), [shelves]);
  const totalSize = useMemo(() => documents.reduce((sum, d) => sum + d.size, 0), [documents]);

  const matches = (doc: DocumentSummary) => {
    if (!matchesQuery(doc, query, categories, assets)) return false;
    if (filter === null) return true;
    if (filter === "__expiring") return needsAttention(expiryInfo(doc.expiresAt, now));
    if (filter === "__unread") return !isReadByHinthia(doc);
    return (doc.categoryId ?? "") === filter;
  };

  const filtering = filter !== null || query.trim() !== "";
  const lit = onShelf.filter((s) => matches(s.doc)).length;
  const matchesAll = filtering ? documents.filter(matches).length : documents.length;
  const outside = Math.max(0, matchesAll - lit);

  const categoriesWithDocs = categories
    .filter((c) => documents.some((d) => d.categoryId === c.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const hasUncategorized = documents.some((d) => d.categoryId === null);
  const filters: { key: Filter; label: string; dot: string }[] = [
    { key: null, label: "Tutti", dot: "#9aa1bd" },
    ...categoriesWithDocs.map((c) => ({ key: c.id, label: c.name, dot: categoryColor(c.name) })),
    ...(hasUncategorized ? [{ key: "", label: UNCATEGORIZED_NAME, dot: UNCATEGORIZED_COLOR }] : []),
    { key: "__expiring", label: "In scadenza", dot: "#e5484d" },
    { key: "__unread", label: "Da leggere", dot: "#2b4fc4" },
  ];

  const selected = selectedId ? (documents.find((d) => d.id === selectedId) ?? null) : null;
  const selectedCategory = selected ? data.categoryFor(selected) : undefined;
  const selectedColor = selectedCategory ? categoryColor(selectedCategory.name) : UNCATEGORIZED_COLOR;
  const selectedInfo = selected ? expiryInfo(selected.expiresAt, now) : null;

  function spineButton(spine: Spine) {
    const doc = spine.doc;
    const category = data.categoryFor(doc);
    const isSelected = selectedId === doc.id;
    const info = expiryInfo(doc.expiresAt, now);
    const ribbon = info.level === "overdue" || info.level === "danger" ? "#e5484d" : info.level === "warn" ? "#f0b429" : "transparent";
    const color = category ? categoryColor(category.name) : "#8d96b5";
    const shade = category ? categoryShade(category.name) : "#6f7898";
    return (
      <div
        key={doc.id}
        className="box-border flex items-end border-b-[9px] border-[#c9d0e6] px-px dark:border-zinc-700"
        style={{ gridColumn: `span ${spine.span}`, height: SHELF_ROW_HEIGHT }}
      >
        <button
          type="button"
          onClick={() => setSelectedId(isSelected ? null : doc.id)}
          aria-label={doc.filename}
          aria-pressed={isSelected}
          className="relative flex w-full cursor-pointer items-start justify-center overflow-hidden rounded-t-[3px] border-0 px-0 pt-3 pb-2 transition-[transform,opacity,box-shadow] duration-200 hover:-translate-y-4 hover:shadow-[0_12px_20px_rgba(18,26,53,0.28)]"
          style={{
            height: spine.height,
            background: `linear-gradient(90deg, ${color}, ${shade})`,
            opacity: matches(doc) ? 1 : DIMMED_OPACITY,
            transform: isSelected ? "translateY(-16px)" : undefined,
            outline: isSelected ? "2px solid #2b4fc4" : "none",
            outlineOffset: 2,
          }}
        >
          <span className="absolute inset-x-0 top-0 h-[7px]" style={{ background: ribbon }} />
          <span className="max-h-full overflow-hidden text-[10.5px] font-semibold text-ellipsis whitespace-nowrap text-white/95 [writing-mode:vertical-rl] rotate-180">
            {doc.filename.replace(/\.[a-z0-9]{2,5}$/i, "")}
          </span>
          <span
            className="absolute bottom-1 left-1/2 -ml-[2.5px] h-[5px] w-[5px] rounded-full"
            style={{ background: isReadByHinthia(doc) ? "rgba(255,255,255,0.9)" : "transparent" }}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px] text-[#121a35] dark:text-zinc-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-[30px] leading-tight font-extrabold tracking-[-0.02em] text-brand">Archivio</h1>
          <p className="text-[13.5px] text-[#5b6483] dark:text-zinc-400">
            {documents.length.toLocaleString("it-IT")} documenti · {totalSize >= 1024 * 1024 ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(totalSize / 1024)} KB`}, il più recente in alto e il più vecchio in basso
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ArchiveViewSwitcher />
          <label className="flex w-full items-center gap-2.5 rounded-xl border-[1.5px] border-[#dfe3f0] bg-white px-3.5 sm:w-80 dark:border-zinc-800 dark:bg-zinc-950">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5b6483" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.5" y2="16.5" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cerca nell'archivio"
              placeholder="Cerca un volume…"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-[#121a35] outline-none dark:text-zinc-100"
            />
          </label>
          <AddContentMenu className="rounded-xl px-[18px] py-[11px] text-sm font-bold" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="pr-1 text-[12.5px] font-bold tracking-[0.06em] text-[#5b6483] uppercase dark:text-zinc-400">Illumina</span>
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3.5 py-[7px] text-[13.5px] font-semibold transition-colors",
                active
                  ? "border-brand bg-brand text-white"
                  : "border-[#dfe3f0] bg-white text-[#121a35] hover:bg-[#e8edfc] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900",
              )}
            >
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: f.dot }} />
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-stretch gap-7 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 gap-3.5 rounded-2xl border border-[#dfe3f0] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="hidden w-[74px] shrink-0 flex-col sm:flex">
            {shelves.map((shelf, i) => (
              <div key={i} className="flex items-end pb-3.5" style={{ height: SHELF_ROW_HEIGHT }}>
                <span className="font-heading text-[13px] leading-tight font-extrabold text-[#5b6483] dark:text-zinc-400">{shelf.label}</span>
              </div>
            ))}
          </div>
          <div className="grid min-w-0 flex-1 items-end" style={{ gridTemplateColumns: `repeat(${SHELF_COLUMNS}, minmax(0, 1fr))` }}>
            {onShelf.map((spine) => spineButton(spine))}
          </div>
        </div>

        <aside aria-label="Dettaglio del volume" className="flex min-h-[420px] w-full shrink-0 flex-col gap-3.5 rounded-2xl border border-[#dfe3f0] bg-white p-[18px] xl:w-[290px] dark:border-zinc-800 dark:bg-zinc-950">
          {selected ? (
            <div className="flex flex-col gap-3.5">
              <SelectedPreview doc={selected} color={selectedColor} />
              <div className="flex flex-col gap-1.5">
                <div className="font-heading text-lg leading-tight font-extrabold">{selected.filename}</div>
                <div className="flex items-center gap-2 text-[13px] text-[#5b6483] dark:text-zinc-400">
                  <span className="h-[9px] w-[9px] rounded-full" style={{ background: selectedColor }} />
                  {selectedCategory?.name ?? UNCATEGORIZED_NAME} · {formatDayMonthYear(selected.createdAt)}
                </div>
                {selectedInfo && selectedInfo.text ? <ExpiryPill info={selectedInfo} className="self-start text-xs" /> : null}
                <div className="text-[13px] text-[#5b6483] dark:text-zinc-400">{isReadByHinthia(selected) ? "Letto da Hinthia" : "Ancora da leggere con Hinthia"}</div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/archive/${selected.id}`}
                  className="flex-1 rounded-[10px] bg-brand px-2.5 py-2.5 text-center text-[13.5px] font-bold text-white hover:bg-brand-hover"
                >
                  Apri
                </Link>
                <button
                  type="button"
                  disabled={busyDocId === selected.id}
                  onClick={() => handleOpen(selected)}
                  className="flex-1 rounded-[10px] border border-[#c9d0e6] bg-white px-2.5 py-2.5 text-[13.5px] font-semibold text-[#121a35] hover:border-brand disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  Scarica
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="self-start text-[12.5px] font-semibold text-[#5b6483] underline hover:text-[#121a35] dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Rimetti a posto
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 text-sm leading-normal text-[#5b6483] dark:text-zinc-400">
              <span className="font-heading text-lg leading-tight font-extrabold text-brand">Sfoglia lo scaffale</span>
              <span>Passa sopra un dorso: si solleva. Clicca per aprirne la scheda qui.</span>
              <span>
                Il colore è la categoria, l&apos;altezza è il peso del file, il nastrino in cima è una scadenza vicina e il puntino in basso dice che Hinthia l&apos;ha letto.
              </span>
            </div>
          )}
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-[#6b7391] dark:text-zinc-400">
        <span>
          Mostro i {onShelf.length.toLocaleString("it-IT")} documenti più recenti di {documents.length.toLocaleString("it-IT")}
          {documents.length > onShelf.length ? ": gli altri si trovano con la ricerca o con le altre viste" : ""}
        </span>
        <span>
          {filtering
            ? `${lit} ${lit === 1 ? "documento illuminato" : "documenti illuminati"} su ${onShelf.length}${outside > 0 ? ` · altri ${outside} fuori dallo scaffale` : ""}`
            : `${onShelf.length} documenti in vista`}
        </span>
      </div>
    </div>
  );
}
