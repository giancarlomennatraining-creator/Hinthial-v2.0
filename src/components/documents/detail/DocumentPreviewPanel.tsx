import Link from "next/link";
import { CONTENT_KIND_LABEL, hasInlinePlayer, type ContentKind } from "@/lib/content-kind";
import { PANEL } from "@/components/ui/styles";
import { LoadingText } from "@/components/ui/LoadingText";
import type { DocumentListItem } from "@/domain/documents/types";
import type { useDocumentPreview } from "@/components/documents/detail/useDocumentPreview";

/** Colonna fissa: solo l'anteprima, sempre visibile, mai dietro una tab, con il rimando all'attività del contenuto. */
export function DocumentPreviewPanel({
  doc,
  kind,
  preview,
}: {
  doc: DocumentListItem;
  kind: ContentKind;
  preview: ReturnType<typeof useDocumentPreview>;
}) {
  const { isPdf, previewUrl, noteBody, previewLoading, pdfPageCount, previewIsThumbnail, loadPreview } = preview;

  return (
    <>
      <section aria-label="Anteprima" className={`${PANEL} flex flex-col gap-3 p-4`}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Anteprima</h2>
        {previewLoading ? (
          <LoadingText />
        ) : kind === "note" ? (
          <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {noteBody || "(nota vuota)"}
          </p>
        ) : (kind === "image" || isPdf) && previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo */}
            <img
              src={previewUrl}
              alt={
                isPdf ? `Prima pagina di ${doc.filename}` : doc.filename
              }
              className="max-h-[32rem] max-w-full self-start rounded-md border border-zinc-200 dark:border-zinc-800"
            />
            {isPdf && pdfPageCount !== null ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {pdfPageCount === 1
                  ? "Pagina unica."
                  : `Prima pagina di ${pdfPageCount}.`}{" "}
                Usa &laquo;Scarica&raquo; per sfogliarlo tutto.
              </p>
            ) : previewIsThumbnail ? (
              // La miniatura non porta il numero di pagine: didascalia più generica.
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Anteprima. Usa &laquo;Scarica&raquo; per l&apos;originale
                {isPdf ? ", pagina per pagina" : ""}.
              </p>
            ) : null}
          </>
        ) : hasInlinePlayer(kind) && previewUrl ? (
          kind === "video" ? (
            <video src={previewUrl} controls className="max-h-[32rem] max-w-full rounded-md" />
          ) : (
            <audio src={previewUrl} controls className="w-full" />
          )
        ) : hasInlinePlayer(kind) ? (
          <button
            type="button"
            onClick={loadPreview}
            className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Riproduci
          </button>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isPdf
              ? "Non sono riuscito a disegnarne l'anteprima."
              : `Un ${CONTENT_KIND_LABEL[kind].toLowerCase()} di questo tipo non si può sfogliare qui.`}{" "}
            Usa &laquo;Scarica&raquo; per aprirlo con il tuo programma.
          </p>
        )}
      </section>
      <Link
        href={`/settings?tab=security&section=activity&entity=document:${doc.id}`}
        className="self-start text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        Vedi attività di questo contenuto →
      </Link>
    </>
  );
}
