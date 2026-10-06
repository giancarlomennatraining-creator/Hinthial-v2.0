"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArchiveViewSwitcher } from "@/components/documents/archive/ArchiveViewSwitcher";
import { ChipMenu } from "@/components/documents/archive/ChipMenu";
import { AddContentMenu, DrawnPage, ExpiryPill } from "@/components/documents/archive/parts";
import { useThumbnail } from "@/components/documents/archive/thumbnails";
import type { ArchiveData } from "@/components/documents/archive/useArchiveData";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import {
  categoryColor,
  expiryInfo,
  formatDayMonth,
  groupByMonth,
  isReadByHinthia,
  matchesQuery,
  monthLong,
  parseIsoDate,
  UNCATEGORIZED_COLOR,
  UNCATEGORIZED_NAME,
  upcomingExpiries,
} from "@/domain/documents/archive-views";
import type { DocumentSummary } from "@/domain/documents/types";
import { contentKindFor, CONTENT_KIND_LABEL, type ContentKind } from "@/lib/content-kind";
import { formatSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Vista "Linea del tempo": i documenti per mese di aggiunta lungo una linea, con in cima le scadenze in arrivo e a
 * destra la mappa dei mesi, per saltare a un mese senza scorrere. Pensata per quando si ricorda *quando*, non *come* si chiama.
 */

const FIRST_MONTH_ROWS = 4;
const MORE_STEP = 20;

function RowThumb({ doc, color }: { doc: DocumentSummary; color: string }) {
  const { url, ref } = useThumbnail(doc);
  return (
    <div ref={ref} className="h-[52px] w-10 overflow-hidden rounded bg-white shadow-[0_1px_3px_rgba(18,26,53,0.16)]">
      {url ? (
        <>
          <div style={{ height: 9, background: color }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo */}
          <img src={url} alt="" className="h-[43px] w-full object-cover object-top" />
        </>
      ) : (
        <DrawnPage color={color} headerHeight={9} lines={[85, 60, 75]} lineHeight={3} gap={4} padding="6px 5px" />
      )}
    </div>
  );
}

const SCADENZA_OPTIONS = [
  { value: "soon", label: "In scadenza (60 giorni)" },
  { value: "overdue", label: "Già scadute" },
  { value: "has", label: "Con una scadenza" },
  { value: "none", label: "Senza scadenza" },
];

export function TimelineView({ data }: { data: ArchiveData }) {
  const { documents, categories, assets, handleOpen, handleDelete, busyDocId } = data;
  const [now] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState("");
  const [asset, setAsset] = useState("");
  const [expiry, setExpiry] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});

  const filtered = useMemo(
    () =>
      documents.filter((d) => {
        if (!matchesQuery(d, query, categories, assets)) return false;
        if (category !== "" && (d.categoryId ?? "") !== (category === "none" ? "" : category)) return false;
        if (kind !== "" && contentKindFor(d.mimeType) !== kind) return false;
        if (asset !== "" && d.relatedAssetId !== asset) return false;
        if (unreadOnly && isReadByHinthia(d)) return false;
        if (expiry !== "") {
          const info = expiryInfo(d.expiresAt, now);
          if (expiry === "soon" && !(info.days !== null && info.days >= 0 && info.days <= 60)) return false;
          if (expiry === "overdue" && info.level !== "overdue") return false;
          if (expiry === "has" && info.days === null) return false;
          if (expiry === "none" && info.days !== null) return false;
        }
        return true;
      }),
    [documents, query, category, kind, asset, expiry, unreadOnly, categories, assets, now],
  );

  const months = useMemo(() => groupByMonth(filtered), [filtered]);
  const maxCount = Math.max(1, ...months.map((m) => m.count));
  const shownMonths = month ? months.filter((m) => m.key === month) : months;
  const upcoming = useMemo(() => upcomingExpiries(documents, now, 60), [documents, now]);
  const totalSize = useMemo(() => documents.reduce((sum, d) => sum + d.size, 0), [documents]);
  const oldest = documents.length > 0 ? documents.reduce((a, d) => (d.createdAt < a ? d.createdAt : a), documents[0].createdAt) : null;
  const oldestDate = oldest ? new Date(oldest) : null;

  const categoryOptions = [
    ...categories.map((c) => ({ value: c.id, label: c.name })).sort((a, b) => a.label.localeCompare(b.label)),
    ...(documents.some((d) => d.categoryId === null) ? [{ value: "none", label: UNCATEGORIZED_NAME }] : []),
  ];
  const kindOptions = (Object.keys(CONTENT_KIND_LABEL) as ContentKind[])
    .filter((k) => documents.some((d) => contentKindFor(d.mimeType) === k))
    .map((k) => ({ value: k, label: CONTENT_KIND_LABEL[k] }));
  const assetOptions = assets
    .filter((a) => documents.some((d) => d.relatedAssetId === a.id))
    .map((a) => ({ value: a.id, label: a.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex flex-col gap-[18px] text-[#121a35] dark:text-zinc-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-[30px] leading-tight font-extrabold tracking-[-0.02em] text-brand">Archivio</h1>
          <p className="text-[13.5px] text-[#5b6483] dark:text-zinc-400">
            {documents.length} documenti{oldestDate ? ` dal ${monthLong(oldestDate.getMonth()).toLowerCase()} ${oldestDate.getFullYear()}` : ""} · {formatSize(totalSize)}, tutti cifrati sul tuo dispositivo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ArchiveViewSwitcher />
          <AddContentMenu className="rounded-xl px-[18px] py-[11px] text-sm font-bold" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex min-w-[260px] flex-[1_1_360px] items-center gap-2.5 rounded-[14px] border-[1.5px] border-[#dfe3f0] bg-white px-3.5 dark:border-zinc-800 dark:bg-zinc-950">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5b6483" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMonth(null);
            }}
            aria-label="Cerca nell'archivio"
            placeholder="Cerca per nome, emittente, targa, tag…"
            className="min-w-0 flex-1 bg-transparent py-[11px] text-[14.5px] text-[#121a35] outline-none dark:text-zinc-100"
          />
        </label>
        <ChipMenu label="Categoria" value={category} onChange={(v) => { setCategory(v); setMonth(null); }} options={categoryOptions} allLabel="Tutte le categorie" />
        <ChipMenu label="Tipo" value={kind} onChange={(v) => { setKind(v); setMonth(null); }} options={kindOptions} allLabel="Tutti i tipi" />
        {assetOptions.length > 0 ? (
          <ChipMenu label="Bene" value={asset} onChange={(v) => { setAsset(v); setMonth(null); }} options={assetOptions} allLabel="Tutti i beni" />
        ) : null}
        <ChipMenu label="Scadenza" value={expiry} onChange={(v) => { setExpiry(v); setMonth(null); }} options={SCADENZA_OPTIONS} allLabel="Qualsiasi" />
        <button
          type="button"
          aria-pressed={unreadOnly}
          onClick={() => {
            setUnreadOnly((v) => !v);
            setMonth(null);
          }}
          className={cn(
            "rounded-xl border-[1.5px] px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors",
            unreadOnly
              ? "border-brand bg-brand/10 text-brand"
              : "border-[#dfe3f0] bg-white text-[#121a35] hover:border-brand hover:bg-[#f1f5ff] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
          )}
        >
          Da leggere con Hinthia
        </button>
      </div>

      <div className="flex flex-col items-stretch gap-7 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {upcoming.length > 0 ? (
            <section aria-label="In arrivo" className="flex flex-col gap-2.5 rounded-2xl border border-[#dfe3f0] bg-white px-[18px] py-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-baseline gap-2.5">
                <h2 className="font-heading text-base font-extrabold">In arrivo</h2>
                <span className="text-[13px] text-[#5b6483] dark:text-zinc-400">
                  {upcoming.length} {upcoming.length === 1 ? "scadenza" : "scadenze"} nei prossimi 60 giorni
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                {upcoming.slice(0, 3).map(({ doc, info }) => {
                  const red = info.level === "overdue" || info.level === "danger";
                  const d = parseIsoDate(doc.expiresAt as string);
                  return (
                    <Link
                      key={doc.id}
                      href={`/archive/${doc.id}`}
                      className="flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 transition-shadow hover:shadow-md"
                      style={{ background: red ? "#fde9e7" : "#fdf3dd", borderColor: red ? "#f6c9c4" : "#f1deaa" }}
                    >
                      <span className="w-11 shrink-0 rounded-[9px] bg-white py-[5px] text-center shadow-[0_1px_3px_rgba(18,26,53,0.12)]">
                        <span className="block font-heading text-lg leading-none font-extrabold" style={{ color: red ? "#b42318" : "#8a5a00" }}>
                          {d.getDate()}
                        </span>
                        <span className="block text-[10.5px] font-bold tracking-[0.06em] text-[#5b6483] uppercase">
                          {formatDayMonth(doc.expiresAt as string).split(" ")[1]}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-col gap-px">
                        <span className="truncate text-[13.5px] font-bold text-[#121a35]">{doc.filename}</span>
                        <span className="text-xs font-semibold" style={{ color: red ? "#b42318" : "#8a5a00" }}>
                          {info.text.replace("scade ", "")}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Nessun contenuto corrisponde ai filtri.
            </p>
          ) : (
            <div className="max-h-[calc(100vh-22rem)] min-h-[420px] overflow-y-auto pr-1.5">
              <div className="ml-3.5 flex flex-col border-l-2 border-[#d4daee] pl-[26px] dark:border-zinc-800">
                {shownMonths.map((group) => {
                  const limit = limits[group.key] ?? (month ? MORE_STEP : FIRST_MONTH_ROWS);
                  const rows = group.docs.slice(0, limit);
                  const remaining = group.docs.length - rows.length;
                  return (
                    <div key={group.key} className="flex flex-col">
                      <div className="sticky top-0 z-[2] flex items-baseline gap-2.5 bg-background pt-3.5 pb-2">
                        <span className="absolute top-[22px] -left-[35px] box-content h-4 w-4 rounded-full border-[3px] border-background bg-brand" />
                        <h3 className="font-heading text-[17px] font-extrabold">{group.label}</h3>
                        <span className="text-[13px] text-[#5b6483] dark:text-zinc-400">{group.count} documenti</span>
                      </div>
                      {rows.map((doc) => {
                        const cat = data.categoryFor(doc);
                        const color = cat ? categoryColor(cat.name) : UNCATEGORIZED_COLOR;
                        const info = expiryInfo(doc.expiresAt, now);
                        const busy = busyDocId === doc.id;
                        return (
                          <div
                            key={doc.id}
                            className="group relative grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-[#f6f8ff] md:grid-cols-[40px_minmax(0,1fr)_auto_108px] dark:hover:bg-zinc-900"
                          >
                            <span
                              className="absolute top-1/2 -left-[34px] -mt-[5px] box-content h-2.5 w-2.5 rounded-full border-2 border-background"
                              style={{ background: color }}
                            />
                            <RowThumb doc={doc} color={color} />
                            <Link href={`/archive/${doc.id}`} className="flex min-w-0 flex-col gap-0.5 hover:text-brand">
                              <span className="truncate text-[14.5px] font-bold">{doc.filename}</span>
                              <span className="text-[12.5px] text-[#5b6483] dark:text-zinc-400">
                                {cat?.name ?? UNCATEGORIZED_NAME} · {CONTENT_KIND_LABEL[contentKindFor(doc.mimeType)]} · {formatSize(doc.size)}
                              </span>
                            </Link>
                            <div className="flex items-center gap-2.5">
                              <ExpiryPill info={info} className="hidden sm:inline-block" />
                              <span className="w-[46px] text-right text-[13px] text-[#5b6483] dark:text-zinc-400">{formatDayMonth(doc.createdAt)}</span>
                            </div>
                            <div className="hidden justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:flex">
                              <Link
                                href={`/archive/${doc.id}`}
                                aria-label={`Apri ${doc.filename}`}
                                title="Apri"
                                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#c9d0e6] bg-white hover:border-brand dark:border-zinc-700 dark:bg-zinc-950"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M5 12h14" />
                                  <path d="M13 6l6 6-6 6" />
                                </svg>
                              </Link>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleOpen(doc)}
                                aria-label={`Scarica ${doc.filename}`}
                                title="Scarica"
                                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#c9d0e6] bg-white hover:border-brand disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M12 4v11" />
                                  <path d="M7 11l5 5 5-5" />
                                  <path d="M5 20h14" />
                                </svg>
                              </button>
                              <RowActionsMenu label={`Altre azioni per ${doc.filename}`}>
                                <RowMenuItem disabled={busy} danger onClick={() => handleDelete(doc)}>
                                  Elimina
                                </RowMenuItem>
                              </RowActionsMenu>
                            </div>
                          </div>
                        );
                      })}
                      {remaining > 0 ? (
                        <div className="px-2.5 pt-1.5 pb-2.5">
                          <button
                            type="button"
                            onClick={() => setLimits((prev) => ({ ...prev, [group.key]: limit + MORE_STEP }))}
                            className="rounded-[10px] border border-dashed border-[#aab4d8] px-3.5 py-2 text-[13px] font-bold text-brand hover:bg-brand/5"
                          >
                            Mostra gli altri {remaining} di {group.label.toLowerCase()}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <aside aria-label="Mappa del tempo" className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-[#dfe3f0] bg-white px-3.5 pt-4 pb-3.5 xl:w-[270px] dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between px-1.5">
            <h2 className="font-heading text-[15px] font-extrabold">Mappa del tempo</h2>
            <button type="button" onClick={() => setMonth(null)} className="p-1 text-[12.5px] font-bold text-brand hover:underline">
              {month ? "Tutti i mesi" : `${filtered.length.toLocaleString("it-IT")} totali`}
            </button>
          </div>
          <div className="flex max-h-[560px] flex-col gap-px overflow-y-auto">
            {months.map((m, index) => {
              const showYear = index === 0 || months[index - 1].year !== m.year;
              const active = month === m.key;
              return (
                <div key={m.key} className="flex flex-col">
                  {showYear ? (
                    <div className="px-1.5 pt-2.5 pb-1 font-heading text-[11px] font-extrabold tracking-[0.1em] text-[#5b6483] dark:text-zinc-400">{m.year}</div>
                  ) : null}
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={`${m.label}: ${m.count} documenti`}
                    onClick={() => setMonth(active ? null : m.key)}
                    className={cn("flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors", active ? "bg-[#e8edfc] dark:bg-brand/20" : "hover:bg-[#e8edfc] dark:hover:bg-zinc-900")}
                  >
                    <span className={cn("w-7 text-left text-xs", active ? "font-extrabold" : "font-medium")}>{m.short}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-[5px] bg-[#eef0f8] dark:bg-zinc-800">
                      <span
                        className="block h-full rounded-[5px]"
                        style={{ width: `${Math.round((m.count / maxCount) * 100)}%`, background: active ? "#2b4fc4" : m.count / maxCount > 0.7 ? "#6f8ae0" : "#a9b9ee" }}
                      />
                    </span>
                    <span className="w-6 text-right text-xs text-[#5b6483] dark:text-zinc-400">{m.count}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="px-1.5 text-xs leading-snug text-[#6b7391] dark:text-zinc-400">
            Scegli un mese per saltarci: l&apos;archivio si legge nel tempo, non pagina per pagina.
          </p>
        </aside>
      </div>
    </div>
  );
}
