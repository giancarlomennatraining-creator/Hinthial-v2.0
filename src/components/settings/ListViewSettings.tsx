"use client";

import { ListViewToggle } from "@/components/ui/ListViewToggle";
import { LIST_SECTIONS, LIST_SECTION_LABEL } from "@/lib/list-view";

/** Impostazioni -> Aspetto: un interruttore elenco/tabella per ogni sezione con liste --- lo stesso di ListViewToggle usato in ogni sezione, quindi sempre sincronizzato con esso. */
export function ListViewSettings() {
  return (
    <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
      {LIST_SECTIONS.map((section) => (
        <li key={section} className="flex items-center justify-between gap-4 p-3">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">{LIST_SECTION_LABEL[section]}</span>
          <ListViewToggle section={section} />
        </li>
      ))}
    </ul>
  );
}
