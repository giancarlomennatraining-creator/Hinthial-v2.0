import Link from "next/link";
import type { AIContext } from "@/domain/ai/types";

/** Stesse icone già usate per le voci di menu corrispondenti (v. nav-items.ts) --- Categorie non ha una voce di menu propria (vive in Impostazioni), le si dà l'icona già usata come default per una categoria nuova (v. CategoriesPanel.tsx). */
const COUNTERS: {
  key: "documents" | "assets" | "contacts" | "capsules" | "categories";
  label: string;
  icon: string;
  href: string;
}[] = [
  { key: "documents", label: "Archivio", icon: "🗄️", href: "/archive" },
  { key: "assets", label: "Asset", icon: "🏠", href: "/assets" },
  { key: "contacts", label: "Contatti", icon: "🤝", href: "/contacts" },
  { key: "capsules", label: "Capsule", icon: "📦", href: "/capsules" },
  { key: "categories", label: "Categorie", icon: "📁", href: "/settings" },
];

/** Quanti elementi ci sono in ogni sezione, a colpo d'occhio --- niente di nuovo da calcolare: lo stesso AIContext già decifrato per il resto della dashboard. */
export function DashboardCounters({ context }: { context: AIContext }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {COUNTERS.map((counter) => {
        const count = context[counter.key].length;
        return (
          <Link
            key={counter.key}
            href={counter.href}
            aria-label={`${counter.label}: ${count}`}
            className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <span aria-hidden="true" className="text-lg">
              {counter.icon}
            </span>
            <span aria-hidden="true" className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {count}
            </span>
            <span aria-hidden="true" className="text-xs text-zinc-500 dark:text-zinc-400">
              {counter.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
