"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { loadDocumentSegments } from "@/domain/documents/segments";
import type { ContentSegment } from "@/domain/extraction/types";

/**
 * Le pagine lette di un documento, per la provenienza dell'analisi di Hinthia. `ready` dice se il caricamento per il
 * documento di adesso è finito (con `segments: null` se non ci sono): finché non lo è, chi calcola lo stato della
 * lettura salvata deve aspettare, perché le impronte dipendono dalla fonte (pagine o sezioni).
 */
export function useDocumentSegments(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  doc: { storagePath: string; extractedText: string; extractedAt: string | null } | null,
): { segments: ContentSegment[] | null; ready: boolean } {
  const storagePath = doc?.storagePath ?? null;
  const extractedText = doc?.extractedText ?? "";
  // "Rileggi" riscrive i segmenti sotto lo stesso percorso: extractedAt cambia, il percorso no.
  const key = storagePath === null ? null : `${storagePath}|${doc?.extractedAt ?? ""}|${extractedText.length}`;
  const [loaded, setLoaded] = useState<{ key: string; segments: ContentSegment[] | null } | null>(null);

  useEffect(() => {
    if (key === null || storagePath === null) return;
    let cancelled = false;
    loadDocumentSegments(supabase, masterKey, { storagePath, extractedText })
      .catch(() => null)
      .then((segments) => {
        if (!cancelled) setLoaded({ key, segments });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, masterKey, key, storagePath, extractedText]);

  if (key === null) return { segments: null, ready: true };
  return loaded?.key === key ? { segments: loaded.segments, ready: true } : { segments: null, ready: false };
}
