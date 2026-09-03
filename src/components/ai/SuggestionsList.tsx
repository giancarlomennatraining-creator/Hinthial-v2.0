import Link from "next/link";
import type { AISource, AISuggestion } from "@/domain/ai/types";

/** Condiviso tra AIPanel e DashboardWidgets --- stesso "Cose da tenere d'occhio" in entrambi i posti. */
export function SourceList({ sources }: { sources: AISource[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1">
      {sources.map((source) => (
        <li key={`${source.kind}:${source.id}`}>
          <Link
            href={source.href}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {source.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** La stessa box "Cose da tenere d'occhio" mostrata sia in Dashboard sia nell'Assistente AI --- v. domain/ai/mock-provider.ts, suggest(). */
export function SuggestionsList({ suggestions }: { suggestions: AISuggestion[] }) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Cose da tenere d&apos;occhio
      </p>
      {suggestions.map((suggestion, i) => (
        <div key={i} className="text-sm text-zinc-700 dark:text-zinc-300">
          {suggestion.text}
          <SourceList sources={suggestion.sources} />
        </div>
      ))}
    </div>
  );
}
