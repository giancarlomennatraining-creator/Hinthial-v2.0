"use client";

import Link from "next/link";
import type { DocumentSummary } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";
import { categoryColor, expiryInfo, needsAttention, relativeDay } from "@/domain/documents/archive-views";
import { DocumentThumb } from "@/components/documents/archive/DocumentThumb";
import { ExpiryPill } from "@/components/documents/archive/parts";
import { cn } from "@/lib/utils";

/**
 * Un contenuto come scheda: anteprima, titolo, categoria e quando è stato aggiunto, e la scadenza se chiede attenzione. Un solo
 * collegamento, alla scheda del contenuto: scegliere, spostare ed eliminare restano nell'Elenco.
 */
export function DocumentCard({
  doc,
  category,
  masterKey,
  now,
  className,
}: {
  doc: DocumentSummary;
  category: Category | null;
  masterKey: CryptoKey;
  now: Date;
  className?: string;
}) {
  const color = categoryColor(category?.name);
  const info = expiryInfo(doc.expiresAt, now);

  return (
    <Link
      href={`/archive/${doc.id}`}
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden surface-card rounded-card border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(16,24,40,0.10)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    >
      <DocumentThumb doc={doc} masterKey={masterKey} color={color} />
      <span className="flex min-w-0 flex-col gap-1.5 p-3">
        <span className="line-clamp-2 text-sm font-semibold text-zinc-900 group-hover:text-accent dark:text-zinc-100">
          {doc.filename}
        </span>
        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {category ? `${category.icon} ${category.name}` : "Senza categoria"} · {relativeDay(doc.createdAt, now)}
        </span>
        {needsAttention(info) ? <ExpiryPill info={info} className="self-start" /> : null}
      </span>
    </Link>
  );
}
