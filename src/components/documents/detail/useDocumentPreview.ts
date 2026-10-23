"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { bytesToUtf8 } from "@/lib/crypto";
import { downloadDocument, downloadThumbnail } from "@/domain/documents/repository";
import { contentKindFor } from "@/lib/content-kind";
import { renderPdfFirstPage } from "@/lib/pdf";
import type { DocumentListItem } from "@/domain/documents/types";
import { errorMessage } from "@/lib/utils";

/**
 * L'anteprima del contenuto: object URL per immagini/audio/video e per la prima pagina disegnata di un PDF, testo per
 * le note. Immagini, note e PDF si aprono da soli; audio e video no (possono pesare decine di megabyte).
 */
export function useDocumentPreview(
  masterKey: CryptoKey,
  doc: DocumentListItem | null,
  setError: (message: string | null) => void,
) {
  const supabase = useSupabase();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** Pagine del PDF per "prima di N" --- null se non è un PDF o se l'anteprima viene dalla miniatura. */
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  /** Un PDF che pdf.js non è riuscito a disegnare: si ripiega sul messaggio. */
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  /** Vero quando `previewUrl` viene dalla miniatura: non porta il numero di pagine, quindi niente "Prima pagina di N". */
  const [previewIsThumbnail, setPreviewIsThumbnail] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const kind = doc ? contentKindFor(doc.mimeType) : null;

  const isPdf = doc?.mimeType === "application/pdf";

  // Immagine, nota e PDF si aprono da soli: audio e video no, possono pesare decine di megabyte.
  const autoPreview = kind === "image" || kind === "note" || isPdf;

  const loadPreview = useCallback(async () => {
    if (!doc) return;
    setPreviewLoading(true);
    setError(null);
    try {
      if (contentKindFor(doc.mimeType) === "note") {
        const { bytes } = await downloadDocument(supabase, masterKey, doc);
        setNoteBody(bytesToUtf8(bytes));
        return;
      }

      if (doc.mimeType === "application/pdf" || doc.mimeType.startsWith("image/")) {
        // La miniatura evita di scaricare il file intero solo per l'anteprima (v. lib/thumbnail.ts).
        const thumbnail = await downloadThumbnail(supabase, masterKey, doc);
        if (thumbnail) {
          setPreviewUrl(URL.createObjectURL(thumbnail));
          setPreviewIsThumbnail(true);
          return;
        }
      }

      // Nessuna miniatura (tipo non supportato o non generata a suo tempo): si scarica il file intero.
      const { mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);

      if (mimeType === "application/pdf") {
        // Se ne disegna la prima pagina con lo stesso pdf.js che l'OCR usa per leggerle (v. lib/pdf.ts).
        const rendered = await renderPdfFirstPage(bytes);
        if (!rendered) {
          setPreviewUnavailable(true);
          return;
        }
        setPdfPageCount(rendered.pageCount);
        setPreviewUrl(URL.createObjectURL(rendered.image));
        return;
      }

      setPreviewUrl(URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType })));
    } catch (err) {
      setError(errorMessage(err, "Impossibile aprire il contenuto."));
      setPreviewUnavailable(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [supabase, masterKey, doc, setError]);

  // I byte del PDF decifrato, scaricati una volta sola per tutte le pagine che si aprono dalla lettura di Hinthia.
  const pdfBytesRef = useRef<Promise<Uint8Array> | null>(null);
  const loadPdfBytes = useCallback(() => {
    if (!doc) return Promise.reject(new Error("Contenuto non disponibile."));
    if (!pdfBytesRef.current) {
      pdfBytesRef.current = downloadDocument(supabase, masterKey, doc)
        .then(({ bytes }) => bytes)
        .catch((err) => {
          pdfBytesRef.current = null;
          throw err;
        });
    }
    return pdfBytesRef.current;
  }, [supabase, masterKey, doc]);

  useEffect(() => {
    if (!doc || !autoPreview) return;
    if (previewUrl || noteBody !== null || previewLoading || previewUnavailable) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPreview();
  }, [doc, autoPreview, previewUrl, noteBody, previewLoading, previewUnavailable, loadPreview]);

  return {
    kind,
    isPdf,
    previewUrl,
    noteBody,
    previewLoading,
    pdfPageCount,
    previewUnavailable,
    previewIsThumbnail,
    loadPreview,
    loadPdfBytes,
  };
}
