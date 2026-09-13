"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMainNavItems } from "@/components/layout/MainNavItemsProvider";
import { NAV_ITEMS } from "@/components/layout/nav-items";

/**
 * Impostazioni -> Aspetto: quali voci compaiono nella barra di
 * navigazione generale (sidebar o barra orizzontale), e in che ordine
 * --- stesso pattern di BottomNavItemsSettings (trascina o usa le
 * frecce ▲▼ per riordinare), ma senza un tetto massimo di voci: qui non
 * c'è un "altrove" dove ritrovare una voce tolta, quindi nessun limite
 * artificiale di quante restare visibili.
 */
export function MainNavItemsSettings() {
  const { items, setItems } = useMainNavItems();
  const [error, setError] = useState(false);
  const [dragHref, setDragHref] = useState<string | null>(null);
  const [overHref, setOverHref] = useState<string | null>(null);

  const visible = items
    .map((href) => NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is (typeof NAV_ITEMS)[number] => item !== undefined);
  const hidden = NAV_ITEMS.filter((item) => !items.includes(item.href));

  async function persist(next: string[]) {
    setError(false);
    try {
      await setItems(next);
    } catch {
      setError(true);
    }
  }

  function move(href: string, delta: number) {
    const index = items.indexOf(href);
    const target = index + delta;
    if (index === -1 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  }

  function reorderByDrag(targetHref: string) {
    if (!dragHref || dragHref === targetHref) return;
    const from = items.indexOf(dragHref);
    const to = items.indexOf(targetHref);
    if (from === -1 || to === -1) return;
    const next = [...items];
    next.splice(from, 1);
    next.splice(to, 0, dragHref);
    void persist(next);
  }

  function show(href: string) {
    void persist([...items, href]);
  }

  function hide(href: string) {
    void persist(items.filter((h) => h !== href));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Visibili --- in quest&apos;ordine
        </p>
        {visible.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Nessuna voce scelta --- la barra di navigazione non compare.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 rounded-md border border-zinc-300 p-1 dark:border-zinc-700">
            {visible.map((item, index) => (
              <li
                key={item.href}
                draggable
                onDragStart={() => setDragHref(item.href)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overHref !== item.href) setOverHref(item.href);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  reorderByDrag(item.href);
                  setDragHref(null);
                  setOverHref(null);
                }}
                onDragEnd={() => {
                  setDragHref(null);
                  setOverHref(null);
                }}
                className={cn(
                  "flex cursor-grab items-center gap-1 rounded px-2 py-1.5 text-sm font-medium text-zinc-600 active:cursor-grabbing dark:text-zinc-400",
                  overHref === item.href && dragHref !== item.href ? "bg-zinc-100 dark:bg-zinc-900" : "",
                )}
              >
                <span aria-hidden="true" className="select-none px-1 text-zinc-400 dark:text-zinc-600">
                  ⠿
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                <button
                  type="button"
                  aria-label={`Sposta ${item.label} in alto`}
                  disabled={index === 0}
                  onClick={() => move(item.href, -1)}
                  className="rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`Sposta ${item.label} in basso`}
                  disabled={index === visible.length - 1}
                  onClick={() => move(item.href, 1)}
                  className="rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  ▼
                </button>
                <button
                  type="button"
                  aria-label={`Nascondi ${item.label}`}
                  onClick={() => hide(item.href)}
                  className="rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hidden.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Nascoste</p>
          <ul className="flex flex-col gap-1 rounded-md border border-zinc-300 p-1 dark:border-zinc-700">
            {hidden.map((item) => (
              <li key={item.href}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => show(item.href)}
                    className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
                  />
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Una voce nascosta qui non compare più nel menu principale --- resta comunque raggiungibile
        dalla dashboard o dalla ricerca.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          Preferenza non salvata.
        </p>
      ) : null}
    </div>
  );
}
