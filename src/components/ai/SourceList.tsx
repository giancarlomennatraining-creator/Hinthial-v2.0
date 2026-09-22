import Link from "next/link";
import type { AISource } from "@/domain/ai/types";

/** Le fonti citate da una risposta dell'assistente AI --- pillole cliccabili verso la scheda giusta. */
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
