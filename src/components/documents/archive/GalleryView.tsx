"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArchiveViewSwitcher } from "@/components/documents/archive/ArchiveViewSwitcher";
import { BulkActionsBar } from "@/components/documents/archive/BulkActionsBar";
import { AddContentMenu, DrawnPage, ExpiryPill, ReadDot } from "@/components/documents/archive/parts";
import { useThumbnail } from "@/components/documents/archive/thumbnails";
import type { ArchiveData } from "@/components/documents/archive/useArchiveData";
import {
  categoryColor,
  categoryFacets,
  countPresets,
  duplicateIds,
  expiryInfo,
  formatDayMonthYear,
  isReadByHinthia,
  kindFacets,
  matchesPreset,
  matchesQuery,
  UNCATEGORIZED_COLOR,
  UNCATEGORIZED_NAME,
  yearFacets,
  type ArchiveViewPreset,
} from "@/domain/documents/archive-views";
import type { DocumentSummary } from "@/domain/documents/types";
import { contentKindFor, type ContentKind } from "@/lib/content-kind";
import { formatSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Vista "Cassettiera": una galleria di schede con miniatura, viste salvate in cima e filtri a faccette a sinistra.
 * Pensata per sfogliare e restringere: categoria, tipo e anno si combinano, e una barra in basso agisce sui selezionati.
 */

const PAGE_STEP = 60;

type SortMode = "recent" | "name" | "expiry";

const PRESETS: { value: ArchiveViewPreset; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "expiring", label: "In scadenza" },
  { value: "unread", label: "Da leggere" },
  { value: "uncategorized", label: "Senza categoria" },
  { value: "recent", label: "Recenti" },
];

function GalleryCard({
  doc,
  data,
  dense,
  now,
  anySelected,
}: {
  doc: DocumentSummary;
  data: ArchiveData;
  dense: boolean;
  now: Date;
  anySelected: boolean;
}) {
  const { url, ref } = useThumbnail(doc);
  const category = data.categoryFor(doc);
  const color = category ? categoryColor(category.name) : UNCATEGORIZED_COLOR;
  const selected = data.selectedIds.has(doc.id);
  const info = expiryInfo(doc.expiresAt, now);
  const read = isReadByHinthia(doc);
  const showTick = selected || anySelected;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-[14px] bg-white transition-all duration-[180ms] hover:-translate-y-[3px] hover:shadow-[0_14px_30px_rgba(18,26,53,0.12)] dark:bg-zinc-950",
        selected
          ? "border-2 border-brand shadow-[0_10px_26px_rgba(43,79,196,0.22)]"
          : "border border-[#dfe3f0] shadow-[0_2px_6px_rgba(18,26,53,0.04)] dark:border-zinc-800",
      )}
    >
      <Link href={`/archive/${doc.id}`} className="flex flex-col gap-2.5 p-2.5 pb-3" aria-label={`Apri ${doc.filename}`}>
        <div
          ref={ref}
          className={cn("relative overflow-hidden rounded-[9px] bg-[#eef1f9] px-3.5 pt-3 dark:bg-zinc-900", dense ? "h-24" : "h-[150px]")}
        >
          <div className="h-full overflow-hidden rounded-t-[5px] bg-white shadow-[0_1px_3px_rgba(18,26,53,0.14)]">
            {url ? (
              <>
                <div style={{ height: 14, background: color }} />
                {/* eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo */}
                <img src={url} alt="" className="h-full w-full object-cover object-top" />
              </>
            ) : (
              <DrawnPage color={color} />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-[5px] px-1">
          <div className="line-clamp-2 text-sm leading-tight font-bold text-[#121a35] dark:text-zinc-100">{doc.filename}</div>
          <div className="flex items-center gap-1.5 text-xs text-[#5b6483] dark:text-zinc-400">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
            <span className="truncate">
              {category?.name ?? UNCATEGORIZED_NAME} · {formatDayMonthYear(doc.createdAt)}
            </span>
          </div>
          {info.text ? <ExpiryPill info={info} className="self-start" /> : null}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => data.toggleSelected(doc.id)}
        aria-label={`${selected ? "Deseleziona" : "Seleziona"} ${doc.filename}`}
        aria-pressed={selected}
        className={cn(
          "absolute top-[18px] left-[18px] flex h-6 w-6 items-center justify-center rounded-[7px] border-[1.5px] transition-opacity",
          selected ? "border-brand bg-brand" : "border-white bg-[rgba(18,26,53,0.35)]",
          showTick ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
        )}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <span className="pointer-events-none absolute top-[20px] right-[20px]">
        <ReadDot read={read} />
      </span>
    </div>
  );
}

export function GalleryView({ data }: { data: ArchiveData }) {
  const { documents, categories, assets, selectedIds } = data;
  const [now] = useState(() => new Date());
  const [preset, setPreset] = useState<ArchiveViewPreset>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [kind, setKind] = useState<ContentKind | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dense, setDense] = useState(false);
  const [sort, setSort] = useState<SortMode>("recent");
  const [shown, setShown] = useState(PAGE_STEP);

  const counts = useMemo(() => countPresets(documents, now), [documents, now]);
  const duplicates = useMemo(() => duplicateIds(documents), [documents]);
  const catFacets = useMemo(() => categoryFacets(documents, categories), [documents, categories]);
  const typeFacets = useMemo(() => kindFacets(documents), [documents]);
  const yFacets = useMemo(() => yearFacets(documents), [documents]);
  const totalSize = useMemo(() => documents.reduce((sum, d) => sum + d.size, 0), [documents]);

  const filtered = useMemo(() => {
    const list = documents.filter(
      (d) =>
        matchesPreset(d, preset, now, duplicates) &&
        (category === null || (d.categoryId ?? "") === category) &&
        (kind === null || contentKindFor(d.mimeType) === kind) &&
        (year === null || String(new Date(d.createdAt).getFullYear()) === year) &&
        matchesQuery(d, query, categories, assets),
    );
    return [...list].sort((a, b) => {
      if (sort === "name") return a.filename.localeCompare(b.filename);
      if (sort === "expiry") {
        const da = expiryInfo(a.expiresAt, now).days;
        const db = expiryInfo(b.expiresAt, now).days;
        return (da ?? 99999) - (db ?? 99999);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [documents, preset, category, kind, year, query, sort, categories, assets, now, duplicates]);

  const visible = filtered.slice(0, shown);
  const anySelected = selectedIds.size > 0;
  const countOf = (value: ArchiveViewPreset) =>
    value === "all" ? counts.total : value === "expiring" ? counts.expiring : value === "unread" ? counts.unread : value === "uncategorized" ? counts.uncategorized : counts.recent;
  const activeCategoryName = category === null ? null : category === "" ? UNCATEGORIZED_NAME : categories.find((c) => c.id === category)?.name;

  function resetFilters() {
    setPreset("all");
    setCategory(null);
    setKind(null);
    setYear(null);
    setQuery("");
    setShown(PAGE_STEP);
  }

  const facetButton = (active: boolean) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-left transition-colors",
      active ? "bg-[#e8edfc] dark:bg-brand/20" : "hover:bg-[#e8edfc] dark:hover:bg-zinc-900",
    );
  const facetTitle = "px-2.5 pb-1.5 font-heading text-[11px] font-extrabold tracking-[0.1em] text-[#5b6483] uppercase dark:text-zinc-400";

  return (
    <div className="flex flex-col gap-[18px] pb-24 text-[#121a35] dark:text-zinc-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-[30px] leading-tight font-extrabold tracking-[-0.02em] text-brand">Archivio</h1>
          <p className="text-[13.5px] text-[#5b6483] dark:text-zinc-400">
            {documents.length} documenti · {formatSize(totalSize)}, tutti cifrati sul tuo dispositivo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ArchiveViewSwitcher />
          <AddContentMenu className="rounded-xl px-[18px] py-[11px] text-sm font-bold" />
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-2xl border-[1.5px] border-[#dfe3f0] bg-white py-1 pr-2 pl-4 shadow-[0_6px_18px_rgba(18,26,53,0.05)] dark:border-zinc-800 dark:bg-zinc-950">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5b6483" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE_STEP);
          }}
          aria-label="Cerca nell'archivio"
          placeholder="Cerca per nome, emittente, targa, tag…"
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-[#121a35] outline-none dark:text-zinc-100"
        />
        <span className="hidden rounded-lg border border-[#dfe3f0] bg-[#f3f5fb] px-2 py-1 text-xs font-semibold text-[#5b6483] sm:block dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Ctrl K
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const active = preset === p.value;
          return (
            <button
              key={p.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setPreset(p.value);
                setShown(PAGE_STEP);
              }}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3.5 py-[7px] text-[13.5px] font-semibold transition-colors",
                active
                  ? "border-brand bg-brand text-white"
                  : "border-[#dfe3f0] bg-white text-[#121a35] hover:bg-[#e8edfc] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900",
              )}
            >
              <span>{p.label}</span>
              <span className={cn("text-xs font-bold", active ? "text-[#cfdaff]" : "text-[#5b6483] dark:text-zinc-400")}>
                {countOf(p.value).toLocaleString("it-IT")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-6">
        <aside aria-label="Filtri" className="hidden w-[232px] shrink-0 flex-col gap-[18px] lg:flex">
          <div className="flex flex-col gap-0.5">
            <div className={facetTitle}>Categoria</div>
            {catFacets.map((f) => (
              <button key={f.key || "none"} type="button" aria-pressed={category === f.key} onClick={() => { setCategory(category === f.key ? null : f.key); setShown(PAGE_STEP); }} className={facetButton(category === f.key)}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.key === "" ? UNCATEGORIZED_COLOR : categoryColor(f.label) }} />
                <span className={cn("flex-1 truncate text-sm", category === f.key ? "font-bold" : "font-medium")}>{f.label}</span>
                <span className="text-[12.5px] text-[#5b6483] dark:text-zinc-400">{f.count}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className={facetTitle}>Tipo</div>
            {typeFacets.map((f) => (
              <button key={f.key} type="button" aria-pressed={kind === f.kind} onClick={() => { setKind(kind === f.kind ? null : f.kind); setShown(PAGE_STEP); }} className={facetButton(kind === f.kind)}>
                <span className={cn("flex-1 text-sm", kind === f.kind ? "font-bold" : "")}>{f.label}</span>
                <span className="text-[12.5px] text-[#5b6483] dark:text-zinc-400">{f.count}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className={facetTitle}>Anno</div>
            {yFacets.map((f) => (
              <button key={f.key} type="button" aria-pressed={year === f.key} onClick={() => { setYear(year === f.key ? null : f.key); setShown(PAGE_STEP); }} className={facetButton(year === f.key)}>
                <span className={cn("flex-1 text-sm", year === f.key ? "font-bold" : "")}>{f.label}</span>
                <span className="text-[12.5px] text-[#5b6483] dark:text-zinc-400">{f.count}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13.5px] text-[#5b6483] dark:text-zinc-400">
              Mostro {visible.length.toLocaleString("it-IT")} di {filtered.length.toLocaleString("it-IT")}
              {activeCategoryName ? ` · ${activeCategoryName}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={category ?? "__all"}
                onChange={(e) => { setCategory(e.target.value === "__all" ? null : e.target.value); setShown(PAGE_STEP); }}
                aria-label="Filtra per categoria"
                className="rounded-[10px] border border-[#dfe3f0] bg-white px-3 py-[7px] text-[13px] font-semibold text-[#121a35] lg:hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="__all">Tutte le categorie</option>
                {catFacets.map((f) => (
                  <option key={f.key || "none"} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <div role="radiogroup" aria-label="Dimensione delle schede" className="flex gap-0.5 rounded-[10px] border border-[#dfe3f0] bg-white p-[3px] dark:border-zinc-800 dark:bg-zinc-950">
                {[
                  { value: false, label: "Schede grandi" },
                  { value: true, label: "Compatte" },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    role="radio"
                    aria-checked={dense === o.value}
                    onClick={() => setDense(o.value)}
                    className={cn(
                      "rounded-[7px] px-3 py-1.5 text-[13px] font-semibold transition-colors",
                      dense === o.value ? "bg-[#e8edfc] text-brand dark:bg-brand/20" : "text-[#5b6483] dark:text-zinc-400",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                aria-label="Ordina per"
                className="rounded-[10px] border border-[#dfe3f0] bg-white px-3 py-[7px] text-[13px] font-semibold text-[#121a35] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="recent">Più recenti</option>
                <option value="name">Nome</option>
                <option value="expiry">Scadenza vicina</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessun contenuto corrisponde ai filtri.</p>
              <button type="button" onClick={resetFilters} className="mt-3 text-sm font-semibold text-brand underline-offset-2 hover:underline">
                Togli i filtri
              </button>
            </div>
          ) : (
            <div className={cn("grid gap-4", dense ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4")}>
              {visible.map((doc) => (
                <GalleryCard key={doc.id} doc={doc} data={data} dense={dense} now={now} anySelected={anySelected} />
              ))}
            </div>
          )}

          {filtered.length > visible.length ? (
            <div className="flex items-center justify-center gap-3 pt-1.5">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE_STEP)}
                className="rounded-[10px] border border-[#c9d0e6] bg-white px-4 py-[9px] text-[13.5px] font-semibold text-[#121a35] transition-colors hover:border-brand dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                Mostra altri {Math.min(PAGE_STEP, filtered.length - visible.length)}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <BulkActionsBar data={data} />
    </div>
  );
}
