"use client";

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { ThumbnailProvider, useThumbnail } from "@/components/documents/archive/thumbnails";
import type { SummaryContext } from "@/domain/ai/types";
import { agoText } from "@/domain/dashboard/deadlines";
import { categoryColor, UNCATEGORIZED_COLOR } from "@/domain/documents/archive-views";
import type { DocumentSummary } from "@/domain/documents/types";

/** Una scheda di "Aggiunti di recente": la miniatura vera del file dove c'è, altrimenti una pagina disegnata nel colore della categoria. */
function RecentDocCard({ doc, color, now }: { doc: DocumentSummary; color: string; now: Date }) {
  const { url, ref } = useThumbnail(doc);
  return (
    <Link
      href={`/archive/${doc.id}`}
      aria-label={`Apri ${doc.filename}`}
      className="w-[124px] shrink-0 snap-start overflow-hidden rounded-[14px] border border-zinc-200 bg-white transition-transform hover:-translate-y-[3px] dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div
        ref={ref}
        className="relative h-[62px] overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${color}, color-mix(in srgb, ${color} 55%, #000))` }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo
          <img src={url} alt="" className="size-full object-cover object-top" />
        ) : (
          <div aria-hidden="true" className="absolute inset-x-3.5 top-3.5 flex flex-col gap-[5px]">
            <span className="h-[3px] rounded-sm bg-white/60" />
            <span className="h-[3px] rounded-sm bg-white/45" />
            <span className="h-[3px] w-3/4 rounded-sm bg-white/30" />
          </div>
        )}
      </div>
      <div className="px-2.5 pb-2 pt-2">
        <span className="block truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{doc.filename}</span>
        <span className="text-[0.7rem] text-zinc-500 dark:text-zinc-400">{agoText(doc.createdAt, now)}</span>
      </div>
    </Link>
  );
}

/** "Aggiunti di recente": schede da scorrere di lato, con la miniatura vera del file dove c'è. Condiviso dagli stili di dashboard che lo mostrano. */
export function DashboardRecentDocuments({
  supabase,
  masterKey,
  context,
  now,
}: {
  supabase: SupabaseClient<Database>;
  masterKey: CryptoKey;
  context: SummaryContext;
  now: Date;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Aggiunti di recente</h3>
      {context.documents.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Ancora nulla in archivio.</p>
      ) : (
        <ThumbnailProvider data={{ supabase, masterKey }}>
          <div className="mt-3 flex snap-x snap-proximity gap-2.5 overflow-x-auto pb-1.5">
            {context.documents.slice(0, 8).map((doc) => {
              const category = context.categories.find((c) => c.id === doc.categoryId);
              return (
                <RecentDocCard
                  key={doc.id}
                  doc={doc}
                  color={category ? categoryColor(category.name) : UNCATEGORIZED_COLOR}
                  now={now}
                />
              );
            })}
          </div>
        </ThumbnailProvider>
      )}
      <Link href="/archive" className="mt-2 inline-block text-xs font-medium text-brand hover:underline">
        Vai all&apos;archivio
      </Link>
    </section>
  );
}
