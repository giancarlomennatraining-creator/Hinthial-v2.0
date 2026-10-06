"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArchiveViewSwitcher } from "@/components/documents/archive/ArchiveViewSwitcher";
import { BulkActionsBar } from "@/components/documents/archive/BulkActionsBar";
import { AddContentMenu, DrawnPage, ExpiryPill, ReadDot } from "@/components/documents/archive/parts";
import { useThumbnail } from "@/components/documents/archive/thumbnails";
import type { ArchiveData } from "@/components/documents/archive/useArchiveData";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import {
  buildCollections,
  categoryColor,
  categoryTint,
  countPresets,
  duplicateIds,
  expiryInfo,
  formatDayMonth,
  formatDayMonthYear,
  isReadByHinthia,
  kindFacets,
  matchesPreset,
  matchesQuery,
  relativeDay,
  sortByNewest,
  UNCATEGORIZED_COLOR,
  type ArchiveViewPreset,
} from "@/domain/documents/archive-views";
import type { DocumentSummary } from "@/domain/documents/types";
import { contentKindFor, CONTENT_KIND_LABEL, type ContentKind } from "@/lib/content-kind";
import { formatSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Vista "Collezioni": dall'insieme al dettaglio. La home dice cosa chiede attenzione e mostra le categorie come pile di
 * fogli; aprendone una si arriva a una tabella ordinabile. Un'idea sola: non una lista lunga, ma un posto per ogni cosa.
 */

type Place =
  | { kind: "home" }
  | { kind: "category"; id: string; name: string; color: string }
  | { kind: "preset"; preset: Exclude<ArchiveViewPreset, "all" | "recent">; name: string };

type SortKey = "name" | "type" | "expiry" | "added";

const PRESET_NAME: Record<Exclude<ArchiveViewPreset, "all" | "recent">, string> = {
  expiring: "In scadenza",
  unread: "Da leggere con Hinthia",
  uncategorized: "Senza categoria",
  duplicates: "Possibili doppioni",
};

const ATTENTION = [
  {
    preset: "expiring" as const,
    label: "In scadenza",
    hint: "entro 60 giorni",
    bg: "#fde9e7",
    fg: "#b42318",
    icon: "M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  {
    preset: "unread" as const,
    label: "Da leggere con Hinthia",
    hint: "per cercarci dentro",
    bg: "#e8edfc",
    fg: "#2b4fc4",
    icon: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  },
  {
    preset: "uncategorized" as const,
    label: "Senza categoria",
    hint: "da mettere in ordine",
    bg: "#fdf3dd",
    fg: "#8a5a00",
    icon: "M20 12l-8 8-9-9V3h8l9 9Z M7.5 7.5h.01",
  },
  {
    preset: "duplicates" as const,
    label: "Possibili doppioni",
    hint: "stesso nome e dimensione",
    bg: "#eef0f8",
    fg: "#475569",
    icon: "M9 9h10v10H9Z M5 15V5h10",
  },
];

const TABLE_COLUMNS =
  "grid-cols-[40px_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_112px_96px_100px]";

const PAGE_STEP = 50;

function MiniThumb({ doc, color }: { doc: DocumentSummary; color: string }) {
  const { url, ref } = useThumbnail(doc);
  return (
    <div ref={ref} className="h-9 w-7 shrink-0 overflow-hidden rounded-[3px] bg-white shadow-[0_1px_3px_rgba(18,26,53,0.2)]">
      {url ? (
        <>
          <div style={{ height: 7, background: color }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo */}
          <img src={url} alt="" className="h-[29px] w-full object-cover object-top" />
        </>
      ) : (
        <DrawnPage color={color} headerHeight={7} lines={[100, 60]} lineHeight={2} gap={3} padding="5px 4px" />
      )}
    </div>
  );
}

function sortDocs(docs: DocumentSummary[], key: SortKey, dir: "asc" | "desc", now: Date): DocumentSummary[] {
  const sign = dir === "asc" ? 1 : -1;
  const copy = [...docs];
  copy.sort((a, b) => {
    switch (key) {
      case "name":
        return a.filename.localeCompare(b.filename) * sign;
      case "type":
        return (CONTENT_KIND_LABEL[contentKindFor(a.mimeType)].localeCompare(CONTENT_KIND_LABEL[contentKindFor(b.mimeType)]) * sign) || a.filename.localeCompare(b.filename);
      case "expiry": {
        const da = expiryInfo(a.expiresAt, now).days;
        const db = expiryInfo(b.expiresAt, now).days;
        return ((da ?? 99999) - (db ?? 99999)) * sign;
      }
      default:
        return a.createdAt.localeCompare(b.createdAt) * sign;
    }
  });
  return copy;
}

export function CollectionsView({ data }: { data: ArchiveData }) {
  const { documents, categories, assets, selectedIds, toggleSelected, toggleSelectAll, handleOpen, handleDelete, busyDocId } = data;
  const [now] = useState(() => new Date());
  const [place, setPlace] = useState<Place>({ kind: "home" });
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [kindFilter, setKindFilter] = useState<ContentKind | null>(null);
  const [shown, setShown] = useState(PAGE_STEP);

  const counts = useMemo(() => countPresets(documents, now), [documents, now]);
  const duplicates = useMemo(() => duplicateIds(documents), [documents]);
  const collections = useMemo(() => buildCollections(documents, categories, now), [documents, categories, now]);
  const recent = useMemo(() => sortByNewest(documents).slice(0, 6), [documents]);
  const totalSize = useMemo(() => documents.reduce((sum, d) => sum + d.size, 0), [documents]);

  const searching = query.trim() !== "";

  // I documenti del posto in cui ci si trova (o di tutta la ricerca), prima dei filtri di tipo.
  const inPlace = useMemo(() => {
    if (searching) return documents.filter((d) => matchesQuery(d, query, categories, assets));
    if (place.kind === "category") return documents.filter((d) => (d.categoryId ?? "") === place.id);
    if (place.kind === "preset") return documents.filter((d) => matchesPreset(d, place.preset, now, duplicates));
    return [];
  }, [searching, query, place, documents, categories, assets, now, duplicates]);

  const kindChips = useMemo(() => kindFacets(inPlace), [inPlace]);
  const listed = useMemo(
    () => sortDocs(kindFilter ? inPlace.filter((d) => contentKindFor(d.mimeType) === kindFilter) : inPlace, sortKey, sortDir, now),
    [inPlace, kindFilter, sortKey, sortDir, now],
  );
  const visible = listed.slice(0, shown);

  function openPlace(next: Place) {
    setPlace(next);
    setKindFilter(null);
    setSortKey("added");
    setSortDir("desc");
    setShown(PAGE_STEP);
    setQuery("");
  }

  function sortBy(key: SortKey, firstDir: "asc" | "desc") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(firstDir);
    }
  }

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");
  const showTable = searching || place.kind !== "home";
  const title = searching ? "Risultati" : place.kind === "home" ? "Archivio" : place.name;
  const subtitle = searching
    ? `${listed.length} ${listed.length === 1 ? "documento" : "documenti"} per «${query.trim()}»`
    : place.kind === "home"
      ? `${documents.length} documenti · ${formatSize(totalSize)}, tutti cifrati sul tuo dispositivo`
      : `${listed.length} ${listed.length === 1 ? "documento" : "documenti"} · ordinati per ${{ name: "nome", type: "tipo", expiry: "scadenza", added: "data di aggiunta" }[sortKey]}`;

  const allVisibleSelected = visible.length > 0 && visible.every((d) => selectedIds.has(d.id));
  const collectionColor = place.kind === "category" ? place.color : UNCATEGORIZED_COLOR;

  return (
    <div className="flex flex-col gap-5 pb-24 text-[#121a35] dark:text-zinc-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          {showTable ? (
            <div className="flex items-center gap-2 text-[13.5px] text-[#5b6483] dark:text-zinc-400">
              <button
                type="button"
                onClick={() => openPlace({ kind: "home" })}
                className="flex items-center gap-1 font-bold text-brand hover:underline"
              >
                ← Archivio
              </button>
              <span>/</span>
              <span className="font-semibold text-[#121a35] dark:text-zinc-100">{title}</span>
            </div>
          ) : null}
          <h1 className="font-heading text-[30px] leading-tight font-extrabold tracking-[-0.02em] text-brand">{title}</h1>
          <p className="text-[13.5px] text-[#5b6483] dark:text-zinc-400">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ArchiveViewSwitcher />
          <label className="flex w-full items-center gap-2.5 rounded-xl border-[1.5px] border-[#dfe3f0] bg-white px-3 sm:w-[330px] dark:border-zinc-800 dark:bg-zinc-950">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5b6483" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
              placeholder="Cerca in tutto l'archivio…"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-[#121a35] outline-none dark:text-zinc-100"
            />
          </label>
          <AddContentMenu label="+ Aggiungi" className="rounded-xl px-[18px] py-[11px] text-sm font-bold" />
        </div>
      </div>

      {!showTable ? (
        <div className="flex flex-col gap-[26px]">
          <section aria-label="Richiedono attenzione" className="flex flex-col gap-3">
            <h2 className="font-heading text-[17px] font-extrabold">Richiedono attenzione</h2>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              {ATTENTION.map((card) => {
                const count = card.preset === "expiring" ? counts.expiring : card.preset === "unread" ? counts.unread : card.preset === "uncategorized" ? counts.uncategorized : counts.duplicates;
                return (
                  <button
                    key={card.preset}
                    type="button"
                    onClick={() => openPlace({ kind: "preset", preset: card.preset, name: PRESET_NAME[card.preset] })}
                    className={cn(
                      "flex items-center gap-3.5 rounded-2xl border border-[#dfe3f0] bg-white px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(18,26,53,0.10)] dark:border-zinc-800 dark:bg-zinc-950",
                      count === 0 && "opacity-60",
                    )}
                  >
                    <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px]" style={{ background: card.bg }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={card.fg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={card.icon} />
                      </svg>
                    </span>
                    <span className="flex min-w-0 flex-col gap-px">
                      <span className="font-heading text-[28px] leading-[1.05] font-extrabold" style={{ color: card.fg }}>
                        {count}
                      </span>
                      <span className="text-[13.5px] font-bold text-[#121a35] dark:text-zinc-100">{card.label}</span>
                      <span className="text-xs text-[#5b6483] dark:text-zinc-400">{card.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-label="Collezioni" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-heading text-[17px] font-extrabold">Collezioni</h2>
              <p className="text-[13px] text-[#5b6483] dark:text-zinc-400">Le categorie, a colpo d&apos;occhio. Aprine una.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {collections.map((c) => {
                const tint = categoryTint(c.id === "" ? null : c.name);
                return (
                  <button
                    key={c.id || "none"}
                    type="button"
                    aria-label={`Apri ${c.name}, ${c.count} documenti`}
                    onClick={() => openPlace({ kind: "category", id: c.id, name: c.name, color: c.color })}
                    className="group flex flex-col gap-3.5 rounded-[18px] border border-[#dfe3f0] bg-white px-3 pt-3 pb-4 text-left shadow-[0_2px_8px_rgba(18,26,53,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(18,26,53,0.14)] dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="relative h-32 overflow-hidden rounded-xl" style={{ background: tint }}>
                      {[
                        { w: 78, h: 104, mx: -39, bottom: -14, cls: "-translate-x-[30px] -rotate-[9deg] origin-bottom group-hover:-translate-x-[18px] group-hover:translate-y-[2px] group-hover:-rotate-12", op: 0.55, lines: [80, 55, 70] },
                        { w: 78, h: 104, mx: -39, bottom: -14, cls: "translate-x-[30px] rotate-[9deg] origin-bottom group-hover:translate-x-[18px] group-hover:translate-y-[2px] group-hover:rotate-12", op: 0.55, lines: [65, 85, 50] },
                      ].map((p, i) => (
                        <div
                          key={i}
                          className={cn("absolute left-1/2 overflow-hidden rounded-[5px] bg-white shadow-[0_2px_6px_rgba(18,26,53,0.2)] transition-transform duration-[250ms]", p.cls)}
                          style={{ width: p.w, height: p.h, marginLeft: p.mx, bottom: p.bottom }}
                        >
                          <div style={{ height: 14, background: c.color, opacity: p.op }} />
                          <div className="flex flex-col gap-[5px] px-2 py-2">
                            {p.lines.map((w, j) => (
                              <div key={j} className="h-1 rounded-sm bg-[#dfe3f0]" style={{ width: `${w}%` }} />
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="absolute left-1/2 -ml-[43px] h-28 w-[86px] overflow-hidden rounded-[5px] bg-white shadow-[0_4px_10px_rgba(18,26,53,0.25)]" style={{ bottom: -10 }}>
                        <div style={{ height: 16, background: c.color }} />
                        <div className="flex flex-col gap-1.5 px-[9px] py-[9px]">
                          {[85, 60, 78, 45].map((w, j) => (
                            <div key={j} className="h-1 rounded-sm bg-[#dfe3f0]" style={{ width: `${w}%` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-2.5 px-1.5">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-heading text-[19px] font-extrabold tracking-[-0.01em]">{c.name}</span>
                        <span className="text-[13px] text-[#5b6483] dark:text-zinc-400">
                          {c.count} documenti · ultimo {relativeDay(c.lastAdded, now)}
                        </span>
                      </div>
                      {c.soon > 0 ? (
                        <span className="whitespace-nowrap rounded-full bg-[#fdf3dd] px-[9px] py-[3px] text-[11.5px] font-bold text-[#8a5a00]">
                          {c.soon} in scadenza
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {recent.length > 0 ? (
            <section aria-label="Aggiunti di recente" className="flex flex-col gap-3">
              <h2 className="font-heading text-[17px] font-extrabold">Aggiunti di recente</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {recent.map((doc) => {
                  const color = doc.categoryId ? categoryColor(data.categoryFor(doc)?.name) : UNCATEGORIZED_COLOR;
                  return (
                    <Link
                      key={doc.id}
                      href={`/archive/${doc.id}`}
                      className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[#dfe3f0] bg-white px-2.5 py-2 transition-colors hover:border-brand dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <MiniThumb doc={doc} color={color} />
                      <span className="flex min-w-0 flex-col gap-px">
                        <span className="truncate text-[12.5px] font-bold">{doc.filename}</span>
                        <span className="text-[11.5px] text-[#5b6483] dark:text-zinc-400">{formatDayMonth(doc.createdAt)}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {kindChips.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setKindFilter(null)}
                aria-pressed={kindFilter === null}
                className={cn(
                  "flex items-center gap-[7px] rounded-full border px-[13px] py-1.5 text-[13px] font-semibold",
                  kindFilter === null ? "border-brand bg-brand text-white" : "border-[#dfe3f0] bg-white text-[#121a35] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
                )}
              >
                Tutti <span className="text-xs opacity-80">{inPlace.length}</span>
              </button>
              {kindChips.map((chip) => (
                <button
                  key={chip.kind}
                  type="button"
                  onClick={() => setKindFilter(kindFilter === chip.kind ? null : chip.kind)}
                  aria-pressed={kindFilter === chip.kind}
                  className={cn(
                    "flex items-center gap-[7px] rounded-full border px-[13px] py-1.5 text-[13px] font-semibold",
                    kindFilter === chip.kind ? "border-brand bg-brand text-white" : "border-[#dfe3f0] bg-white text-[#121a35] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
                  )}
                >
                  {chip.label} <span className="text-xs opacity-80">{chip.count}</span>
                </button>
              ))}
            </div>
          ) : null}

          {listed.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Nessun documento qui.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#dfe3f0] bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <div className="min-w-[900px]">
                <div
                  className={cn(
                    "grid items-center gap-x-3 border-b border-[#dfe3f0] bg-[#f8f9fd] px-4 py-[11px] text-xs font-bold tracking-[0.04em] text-[#5b6483] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
                    TABLE_COLUMNS,
                  )}
                >
                  <span>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={() => toggleSelectAll(visible.map((d) => d.id))}
                      aria-label="Seleziona tutti i documenti mostrati"
                      className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
                    />
                  </span>
                  <button type="button" onClick={() => sortBy("name", "asc")} className="text-left transition-colors hover:text-brand">
                    NOME{arrow("name")}
                  </button>
                  <button type="button" onClick={() => sortBy("type", "asc")} className="text-left transition-colors hover:text-brand">
                    TIPO{arrow("type")}
                  </button>
                  <span>EMITTENTE</span>
                  <button type="button" onClick={() => sortBy("expiry", "asc")} className="text-left transition-colors hover:text-brand">
                    SCADENZA{arrow("expiry")}
                  </button>
                  <button type="button" onClick={() => sortBy("added", "desc")} className="text-left transition-colors hover:text-brand">
                    AGGIUNTO{arrow("added")}
                  </button>
                  <span>HINTHIA</span>
                  <span />
                </div>
                {visible.map((doc) => {
                  const category = data.categoryFor(doc);
                  const color = category ? categoryColor(category.name) : place.kind === "category" ? collectionColor : UNCATEGORIZED_COLOR;
                  const info = expiryInfo(doc.expiresAt, now);
                  const read = isReadByHinthia(doc);
                  const busy = busyDocId === doc.id;
                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        "group grid items-center gap-x-3 border-b border-[#eef0f8] px-4 py-2 transition-colors hover:bg-[#f6f8ff] dark:border-zinc-900 dark:hover:bg-zinc-900",
                        TABLE_COLUMNS,
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelected(doc.id)}
                        aria-label={`Seleziona ${doc.filename}`}
                        className="h-[18px] w-[18px] rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
                      />
                      <Link href={`/archive/${doc.id}`} className="flex min-w-0 items-center gap-3 hover:text-brand">
                        <MiniThumb doc={doc} color={color} />
                        <span className="truncate text-sm font-bold">{doc.filename}</span>
                      </Link>
                      <span className="text-[13.5px] text-[#3d4670] dark:text-zinc-300">{CONTENT_KIND_LABEL[contentKindFor(doc.mimeType)]}</span>
                      <span className="truncate text-[13.5px] text-[#3d4670] dark:text-zinc-300">{doc.issuer || "—"}</span>
                      <span>
                        <ExpiryPill info={info} className="text-xs" />
                      </span>
                      <span className="text-[13.5px] text-[#3d4670] dark:text-zinc-300">{formatDayMonthYear(doc.createdAt)}</span>
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-[#5b6483] dark:text-zinc-400">
                        <ReadDot read={read} />
                        {read ? "Letto" : "Da leggere"}
                      </span>
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <Link
                          href={`/archive/${doc.id}`}
                          aria-label={`Apri ${doc.filename}`}
                          title="Apri"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#c9d0e6] bg-white hover:border-brand dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14" />
                            <path d="M13 6l6 6-6 6" />
                          </svg>
                        </Link>
                        <RowActionsMenu label={`Azioni per ${doc.filename}`}>
                          <RowMenuItem disabled={busy} onClick={() => handleOpen(doc)}>
                            Scarica
                          </RowMenuItem>
                          <RowMenuItem disabled={busy} danger onClick={() => handleDelete(doc)}>
                            Elimina
                          </RowMenuItem>
                        </RowActionsMenu>
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f8f9fd] px-4 py-3 dark:bg-zinc-900">
                  <span className="text-[13px] text-[#5b6483] dark:text-zinc-400">
                    1–{visible.length} di {listed.length}
                  </span>
                  {listed.length > visible.length ? (
                    <button
                      type="button"
                      onClick={() => setShown((n) => n + PAGE_STEP)}
                      className="rounded-[10px] border border-[#c9d0e6] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#121a35] hover:border-brand dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      Mostra altri {Math.min(PAGE_STEP, listed.length - visible.length)}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <BulkActionsBar data={data} />
    </div>
  );
}
