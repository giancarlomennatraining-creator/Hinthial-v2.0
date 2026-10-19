"use client";

import { useEffect, useRef, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { downloadThumbnail } from "@/domain/documents/repository";
import type { DocumentSummary } from "@/domain/documents/types";
import { CONTENT_KIND_ICON, contentKindFor } from "@/lib/content-kind";
import { DrawnPage } from "@/components/documents/archive/parts";
import { cn } from "@/lib/utils";

/**
 * Le miniature già scaricate e decifrate in questa sessione, per chiave: tornando alla Panoramica o cambiando vista non si
 * riscaricano (la banda è il motivo per cui le miniature esistono, v. lib/thumbnail.ts). Legate alla master key, non al
 * documento: se la cassaforte si richiude la chiave sparisce e con lei la cache.
 */
const caches = new WeakMap<CryptoKey, Map<string, string>>();

function cacheFor(masterKey: CryptoKey): Map<string, string> {
  let cache = caches.get(masterKey);
  if (!cache) {
    cache = new Map();
    caches.set(masterKey, cache);
  }
  return cache;
}

/** Al massimo tre scaricamenti alla volta: una griglia di sessanta schede non deve aprire sessanta richieste insieme, soprattutto su telefono. */
const MAX_CONCURRENT = 3;
let active = 0;
const waiting: (() => void)[] = [];

function limited<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      active += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          waiting.shift()?.();
        });
    };
    if (active < MAX_CONCURRENT) run();
    else waiting.push(run);
  });
}

/**
 * L'anteprima di un contenuto in una scheda. Scarica la miniatura vera solo quando la scheda sta per comparire a schermo,
 * e finché non c'è (o se il contenuto non ne ha: note, audio, video, file caricati prima che esistessero) disegna una
 * pagina nel colore della categoria, o l'icona del tipo.
 */
export function DocumentThumb({
  doc,
  masterKey,
  color,
  className,
}: {
  doc: DocumentSummary;
  masterKey: CryptoKey;
  color: string;
  className?: string;
}) {
  const supabase = useSupabase();
  const ref = useRef<HTMLDivElement>(null);
  const cache = cacheFor(masterKey);
  const [url, setUrl] = useState<string | null>(cache.get(doc.id) ?? null);
  const kind = contentKindFor(doc.mimeType);

  useEffect(() => {
    if (!doc.hasThumbnail || url || typeof IntersectionObserver === "undefined") return;
    const element = ref.current;
    if (!element) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        limited(() => downloadThumbnail(supabase, masterKey, doc))
          .then((blob) => {
            if (cancelled || !blob) return;
            const objectUrl = URL.createObjectURL(blob);
            cache.set(doc.id, objectUrl);
            setUrl(objectUrl);
          })
          .catch(() => {
            // Una miniatura è un di più: se non arriva resta il disegno.
          });
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
    // `doc` cambia identità a ogni ricarica dell'elenco: contano l'id, la presenza della miniatura e il suo percorso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.hasThumbnail, doc.storagePath, url, supabase, masterKey, cache]);

  return (
    <div
      ref={ref}
      className={cn("relative aspect-[4/3] overflow-hidden", className)}
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrato sul dispositivo
        <img src={url} alt="" className="h-full w-full object-cover object-top" />
      ) : kind === "document" ? (
        <DrawnPage
          color={color}
          headerHeight={12}
          lineHeight={4}
          gap={5}
          className="absolute top-4 left-1/2 w-[52%] -translate-x-1/2 rounded-t-[5px] shadow-[0_4px_14px_rgba(16,24,40,0.12)]"
          style={{ height: "100%" }}
        />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-4xl">
          {CONTENT_KIND_ICON[kind]}
        </span>
      )}
    </div>
  );
}
