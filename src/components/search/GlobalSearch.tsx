"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { buildAIContext } from "@/domain/ai/context";
import { mockAIProvider } from "@/domain/ai/mock-provider";
import { AI_SOURCE_KIND_LABELS } from "@/domain/ai/labels";
import type { AIContext, AISource } from "@/domain/ai/types";

/**
 * Ricerca globale (Ctrl/Cmd+K): cerca per nome/etichetta su tutto ciò
 * che è già decifrato in memoria (v. domain/ai/context.ts, la stessa
 * base dati dell'Assistente AI) --- nessuna nuova query, nessun dato
 * lascia il browser. Usa mockAIProvider.search() (corrispondenza
 * diretta, non l'espansione relazionale di retrieve()): qui l'utente
 * sta cercando un elemento per nome, non facendo una domanda.
 */
/** `collapsed` --- v. Sidebar: mostra solo l'icona, senza etichetta/scorciatoia (Ctrl/Cmd+K resta comunque attivo). */
export function GlobalSearch({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const { status } = useMasterKey();
  const supabase = useRef(createClient()).current;
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [context, setContext] = useState<AIContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const loadContext = useCallback(async () => {
    if (status.kind !== "unlocked") return;
    setLoading(true);
    setError(null);
    try {
      setContext(await buildAIContext(supabase, status.masterKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i tuoi dati.");
    } finally {
      setLoading(false);
    }
  }, [supabase, status]);

  // Il contesto viene caricato solo alla prima apertura (non ad ogni
  // digitazione): stesso pattern fetch-on-mount di AIPanel/DashboardWidgets.
  useEffect(() => {
    if (!open || context) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadContext();
  }, [open, context, loadContext]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Ctrl/Cmd+K apre/chiude da qualunque pagina --- preventDefault per
  // evitare che il browser intercetti la scorciatoia (barra indirizzi).
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

  const results = context && query.trim() ? mockAIProvider.search(query, context) : [];

  // Riporta l'evidenziazione al primo risultato ogni volta che cambia la
  // query --- aggiustamento di stato durante il render (pattern
  // consigliato da React al posto di un useEffect dedicato solo a
  // resettare uno stato derivato).
  const [queryForActiveIndex, setQueryForActiveIndex] = useState(query);
  if (query !== queryForActiveIndex) {
    setQueryForActiveIndex(query);
    setActiveIndex(0);
  }

  function goTo(source: AISource) {
    router.push(source.href);
    close();
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      goTo(results[activeIndex]);
    }
  }

  const grouped = new Map<AISource["kind"], AISource[]>();
  for (const source of results) {
    const group = grouped.get(source.kind) ?? [];
    group.push(source);
    grouped.set(source.kind, group);
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

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ricerca globale"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Cerca nell'archivio, asset, scadenze, contatti, capsule…"
              className="w-full border-b border-zinc-200 bg-transparent px-4 py-3 text-sm text-zinc-950 outline-none dark:border-zinc-800 dark:text-zinc-50"
            />

            <div className="max-h-96 overflow-y-auto p-2">
              {status.kind !== "unlocked" ? (
                <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Sblocca la cifratura per cercare nei tuoi dati.
                </p>
              ) : error ? (
                <p role="alert" className="px-2 py-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : loading ? (
                <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
              ) : !query.trim() ? (
                <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Digita per cercare per nome tra i tuoi dati.
                </p>
              ) : results.length === 0 ? (
                <p className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Nessun risultato per &quot;{query}&quot;.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {[...grouped.entries()].map(([kind, items]) => (
                    <li key={kind}>
                      <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        {AI_SOURCE_KIND_LABELS[kind]}
                      </p>
                      <ul>
                        {items.map((source) => {
                          const index = results.indexOf(source);
                          return (
                            <li key={`${source.kind}:${source.id}`}>
                              <button
                                type="button"
                                onClick={() => goTo(source)}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={
                                  index === activeIndex
                                    ? "block w-full rounded-md bg-brand px-2 py-2 text-left text-sm text-white"
                                    : "block w-full rounded-md px-2 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                                }
                              >
                                {source.label}
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
          </div>
        </div>
      ) : null}
    </>
  );
}
