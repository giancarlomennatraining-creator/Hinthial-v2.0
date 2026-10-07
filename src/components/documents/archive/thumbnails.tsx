"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { downloadThumbnail } from "@/domain/documents/repository";
import type { DocumentSummary } from "@/domain/documents/types";
import type { ArchiveData } from "@/components/documents/archive/useArchiveData";

/**
 * Le miniature vere dei documenti, scaricate e decifrate solo quando la scheda entra nello schermo. Un'unica cache per
 * tutta la pagina: cambiando vista le miniature già viste non si riscaricano. Al massimo quattro alla volta, perché
 * una galleria di sessanta schede non lanci sessanta richieste insieme.
 */

type Listener = (url: string | null) => void;

class ThumbnailCache {
  private urls = new Map<string, string | null>();
  private pending = new Map<string, Listener[]>();
  private queue: (() => void)[] = [];
  private running = 0;
  private disposed = false;

  constructor(
    private load: (doc: Pick<DocumentSummary, "storagePath" | "hasThumbnail">) => Promise<Blob | null>,
  ) {}

  peek(id: string): string | null | undefined {
    return this.urls.get(id);
  }

  request(doc: DocumentSummary, listener: Listener): () => void {
    const cached = this.urls.get(doc.id);
    if (cached !== undefined) {
      listener(cached);
      return () => {};
    }
    const waiting = this.pending.get(doc.id);
    if (waiting) {
      waiting.push(listener);
    } else {
      this.pending.set(doc.id, [listener]);
      this.queue.push(() => void this.fetch(doc));
      this.pump();
    }
    return () => {
      const list = this.pending.get(doc.id);
      if (list) this.pending.set(doc.id, list.filter((l) => l !== listener));
    };
  }

  private pump() {
    while (this.running < 4 && this.queue.length > 0) {
      const next = this.queue.shift();
      this.running += 1;
      next?.();
    }
  }

  private async fetch(doc: DocumentSummary) {
    let url: string | null = null;
    try {
      const blob = await this.load(doc);
      if (blob && !this.disposed) url = URL.createObjectURL(blob);
    } catch {
      url = null;
    }
    this.running -= 1;
    if (!this.disposed) {
      this.urls.set(doc.id, url);
      for (const listener of this.pending.get(doc.id) ?? []) listener(url);
    }
    this.pending.delete(doc.id);
    this.pump();
  }

  /** Dopo un dispose(): in Strict Mode (sviluppo) React smonta e rimonta senza ricreare l'oggetto, che deve tornare utilizzabile. */
  revive() {
    this.disposed = false;
  }

  dispose() {
    this.disposed = true;
    for (const url of this.urls.values()) if (url) URL.revokeObjectURL(url);
    this.urls.clear();
    this.pending.clear();
    this.queue = [];
  }
}

const ThumbnailContext = createContext<ThumbnailCache | null>(null);

export function ThumbnailProvider({ data, children }: { data: Pick<ArchiveData, "supabase" | "masterKey">; children: React.ReactNode }) {
  const { supabase, masterKey } = data;
  const cache = useMemo(
    () => new ThumbnailCache((doc) => downloadThumbnail(supabase, masterKey, doc)),
    [supabase, masterKey],
  );
  useEffect(() => {
    cache.revive();
    return () => cache.dispose();
  }, [cache]);
  return <ThumbnailContext.Provider value={cache}>{children}</ThumbnailContext.Provider>;
}

/**
 * L'indirizzo della miniatura vera di un documento, o null (nessuna miniatura, non ancora caricata). `ref` va messo sul
 * contenitore: il download parte quando entra nello schermo.
 */
export function useThumbnail(doc: DocumentSummary) {
  const cache = useContext(ThumbnailContext);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [url, setUrl] = useState<string | null>(() => cache?.peek(doc.id) ?? null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !doc.hasThumbnail) return;
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- senza osservatore (test, browser vecchi) si carica subito.
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [doc.hasThumbnail]);

  useEffect(() => {
    if (!visible || !cache || !doc.hasThumbnail) return;
    return cache.request(doc, setUrl);
  }, [visible, cache, doc]);

  return { url, ref: nodeRef };
}
