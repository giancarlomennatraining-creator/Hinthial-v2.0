"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import { useMountedTransition } from "@/lib/use-mounted-transition";
import { cn } from "@/lib/utils";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { buildAIContext } from "@/domain/ai/context";
import { AI_SOURCE_KIND_LABELS } from "@/domain/ai/labels";
import type { AIContext } from "@/domain/ai/types";
import {
  SEARCH_AREAS,
  countByArea,
  searchEverything,
  type SearchArea,
  type SearchResult,
  type SnippetOrigin,
} from "@/domain/search/unified-search";

/**
 * Ricerca unificata (Ctrl/Cmd+K): l'unico punto di ricerca dell'app. Cerca per nome, etichette e anche dentro il
 * testo letto dei documenti, su tutto ciò che è già decifrato in memoria (v. domain/ai/context.ts): nessuna nuova
 * query, nessun dato lascia il dispositivo. Il filtro per area è un chip, non una pagina diversa.
 */

/** Quanti risultati per area quando si guarda "Tutto"; il resto sta dietro "Mostra tutti". */
const PER_AREA_IN_ALL = 3;

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[0.65rem] font-medium leading-none text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
      {children}
    </kbd>
  );
}

const ORIGIN_LABELS: Record<SnippetOrigin, string> = {
  text: "Nel testo",
  notes: "Nelle note",
  transcript: "Trascrizione",
  content: "Nel contenuto",
};

type AreaFilter = "all" | SearchArea;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Evidenzia le parole cercate in un testo breve (nome, riga di contesto). */
function Highlighted({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "gi");
  // split con un gruppo di cattura alterna testo normale (indici pari) e corrispondenze (dispari).
  return (
    <>
      {text.split(pattern).map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-900 dark:text-yellow-100"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** `collapsed`: mostra solo l'icona, senza etichetta/scorciatoia (Ctrl/Cmd+K resta comunque attivo). */
export function GlobalSearch({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const { status } = useMasterKey();
  const supabase = useRef(createClient()).current;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const { mounted, entered } = useMountedTransition(open, 150);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<AreaFilter>("all");
  const [context, setContext] = useState<AIContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setArea("all");
    setActiveIndex(0);
  }, []);

  const loadContext = useCallback(async () => {
    if (status.kind !== "unlocked") return;
    setLoading(true);
    setError(null);
    try {
      setContext(await buildAIContext(supabase, status.masterKey));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossibile caricare i tuoi dati.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, status]);

  // Il contesto viene caricato a ogni apertura (un elemento appena creato o modificato deve essere cercabile), non ad ogni digitazione.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadContext();
  }, [open, loadContext]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Ctrl/Cmd+K apre/chiude da qualunque pagina; preventDefault evita che il browser intercetti la scorciatoia.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasQuery = query.trim().length > 0;
  const all = context && hasQuery ? searchEverything(query, context) : [];
  const counts = countByArea(all);

  const groups = SEARCH_AREAS.filter((a) => area === "all" || a === area)
    .map((a) => {
      const items = all.filter((result) => result.kind === a);
      return {
        area: a,
        items,
        shown: area === "all" ? items.slice(0, PER_AREA_IN_ALL) : items,
      };
    })
    .filter((group) => group.items.length > 0);
  const visible = groups.flatMap((group) => group.shown);

  // Riporta l'evidenziazione al primo risultato al cambio query o area: aggiustamento di stato durante il render, non un useEffect dedicato.
  const searchKey = `${area}|${query}`;
  const [keyForActiveIndex, setKeyForActiveIndex] = useState(searchKey);
  if (searchKey !== keyForActiveIndex) {
    setKeyForActiveIndex(searchKey);
    setActiveIndex(0);
  }

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, searchKey]);

  function goTo(result: SearchResult) {
    router.push(result.href);
    close();
  }

  function cycleArea(direction: 1 | -1) {
    const order: AreaFilter[] = ["all", ...SEARCH_AREAS];
    const next =
      (order.indexOf(area) + direction + order.length) % order.length;
    setArea(order[next]);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Tab") {
      event.preventDefault();
      cycleArea(event.shiftKey ? -1 : 1);
      return;
    }
    if (visible.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % visible.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + visible.length) % visible.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      goTo(visible[activeIndex]);
    }
  }

  function chip(value: AreaFilter, label: string, count: number | null) {
    const pressed = area === value;
    return (
      <button
        key={value}
        type="button"
        aria-pressed={pressed}
        tabIndex={-1}
        onClick={() => {
          setArea(value);
          inputRef.current?.focus();
        }}
        className={cn(
          "inline-flex flex-none items-center gap-1.5 rounded-full px-3 py-1 text-xs",
          pressed
            ? "bg-brand/10 font-semibold text-brand"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
          count === 0 && !pressed && "opacity-50",
        )}
      >
        {label}
        {count !== null ? (
          <span className="tabular-nums opacity-70">{count}</span>
        ) : null}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={collapsed ? "Cerca (Ctrl+K)" : undefined}
        className={
          collapsed
            ? "flex items-center justify-center rounded-md border border-zinc-200 bg-white p-2 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500 dark:hover:bg-zinc-900"
            : "flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500 dark:hover:bg-zinc-900"
        }
      >
        {collapsed ? (
          <>
            <span aria-hidden="true">🔍</span>
            <span className="sr-only">Cerca</span>
          </>
        ) : (
          <>
            <span>🔍 Cerca…</span>
            <kbd className="rounded border border-zinc-300 px-1.5 py-0.5 text-[0.65rem] font-medium text-zinc-400 dark:border-zinc-700">
              Ctrl+K
            </kbd>
          </>
        )}
      </button>

      {mounted
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh] transition-opacity duration-150",
                entered ? "opacity-100" : "opacity-0",
              )}
              onClick={close}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Ricerca globale"
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Cerca in archivio, scadenze, beni, amici, capsule…"
                  aria-label="Cerca"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full border-b border-zinc-200 bg-transparent px-4 py-3.5 text-base text-zinc-950 outline-none dark:border-zinc-800 dark:text-zinc-50"
                />

                <div
                  role="group"
                  aria-label="Filtra per area"
                  className="flex gap-1.5 overflow-x-auto border-b border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  {chip(
                    "all",
                    "Tutto",
                    hasQuery && context ? all.length : null,
                  )}
                  {SEARCH_AREAS.map((a) =>
                    chip(
                      a,
                      AI_SOURCE_KIND_LABELS[a],
                      hasQuery && context ? counts[a] : null,
                    ),
                  )}
                </div>

                <div
                  ref={listRef}
                  className="min-h-[7rem] flex-1 overflow-y-auto p-2"
                >
                  {status.kind !== "unlocked" ? (
                    <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                      Sblocca la cifratura per cercare nei tuoi dati.
                    </p>
                  ) : error ? (
                    <p
                      role="alert"
                      className="px-2 py-3 text-sm text-red-600 dark:text-red-400"
                    >
                      {error}
                    </p>
                  ) : !context && loading ? (
                    <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                      Caricamento…
                    </p>
                  ) : !hasQuery ? (
                    <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                      Scrivi per cercare. Trova per nome, per etichetta e anche
                      dentro il testo letto dei documenti.
                    </p>
                  ) : visible.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                      Nessun risultato per &quot;{query}&quot;
                      {area !== "all" && all.length > 0
                        ? ` in ${AI_SOURCE_KIND_LABELS[area]}, ma ce ne sono ${all.length} altrove: prova "Tutto".`
                        : "."}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {groups.map((group) => (
                        <li key={group.area}>
                          <div className="flex items-baseline justify-between px-2 pb-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                              {AI_SOURCE_KIND_LABELS[group.area]}
                            </p>
                            {area === "all" &&
                            group.items.length > PER_AREA_IN_ALL ? (
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => {
                                  setArea(group.area);
                                  inputRef.current?.focus();
                                }}
                                className="text-xs font-semibold text-brand hover:underline"
                              >
                                Mostra tutti ({group.items.length})
                              </button>
                            ) : null}
                          </div>
                          <ul>
                            {group.shown.map((result) => {
                              const index = visible.indexOf(result);
                              const active = index === activeIndex;
                              return (
                                <li key={`${result.kind}:${result.id}`}>
                                  <button
                                    type="button"
                                    data-active={active}
                                    onClick={() => goTo(result)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={cn(
                                      "block w-full rounded-md px-2 py-2 text-left",
                                      active
                                        ? "bg-brand/10"
                                        : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
                                    )}
                                  >
                                    <span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                                      <Highlighted
                                        text={result.label}
                                        query={query}
                                      />
                                    </span>
                                    {result.detail ? (
                                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                        <Highlighted
                                          text={result.detail}
                                          query={query}
                                        />
                                      </span>
                                    ) : null}
                                    {result.snippet && result.snippetOrigin ? (
                                      <span className="mt-1 flex items-baseline gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                        <span className="flex-none rounded border border-brand px-1.5 text-[0.65rem] font-semibold text-brand">
                                          {ORIGIN_LABELS[result.snippetOrigin]}
                                        </span>
                                        <span className="min-w-0 truncate">
                                          {result.snippet.truncatedStart
                                            ? "…"
                                            : ""}
                                          {result.snippet.before}
                                          <mark className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-900 dark:text-yellow-100">
                                            {result.snippet.match}
                                          </mark>
                                          {result.snippet.after}
                                          {result.snippet.truncatedEnd
                                            ? "…"
                                            : ""}
                                        </span>
                                      </span>
                                    ) : null}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Key>↑</Key>
                    <Key>↓</Key>
                    scegli
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Key>Tab</Key>
                    cambia area
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Key>Invio</Key>
                    apri
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Key>Esc</Key>
                    chiudi
                  </span>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
