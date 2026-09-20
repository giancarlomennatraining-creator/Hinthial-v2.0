"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import { deleteDossier, listDossiers, setDossierStatus } from "@/domain/dossiers/repository";
import { buildDossierTimeline, dossierTotalAmount } from "@/domain/dossiers/timeline";
import { listDocuments } from "@/domain/documents/repository";
import { contentKindFor, CONTENT_KIND_ICON } from "@/lib/content-kind";
import { formatAmount, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/ToastProvider";
import type { DossierListItem } from "@/domain/dossiers/types";
import type { DocumentListItem } from "@/domain/documents/types";

/**
 * FASE 20 --- la scheda di un fascicolo: titolo, descrizione, stato, e
 * la sua **cronologia** --- i documenti collegati, in ordine di data
 * (quella letta da Hinthial nel documento se c'è, v. FASE 18; quella di
 * caricamento altrimenti), con il totale di quanto Hinthial vi ha
 * riconosciuto in importi.
 *
 * Chi collega un documento al fascicolo lo fa dal form del documento,
 * non da qui --- stesso schema già in uso per beni e categorie: qui si
 * legge e si gestisce l'oggetto (rinomina, apri/chiudi, elimina), il
 * collegamento vive dall'altra parte.
 */
export function DossierDetail({ masterKey, dossierId }: { masterKey: CryptoKey; dossierId: string }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();

  const [dossier, setDossier] = useState<DossierListItem | null>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setError(null);
    try {
      const [dossiers, documentsResult] = await Promise.all([
        listDossiers(supabase, masterKey),
        listDocuments(supabase, masterKey),
      ]);
      if (requestId !== latestRequestRef.current) return;
      setDossier(dossiers.find((d) => d.id === dossierId) ?? null);
      setDocuments(documentsResult);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError(err instanceof Error ? err.message : "Impossibile caricare il fascicolo.");
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [supabase, masterKey, dossierId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // "?created=1"/"?updated=1" --- stesso schema di CapsulesPanel.tsx.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  const [showUpdatedMessage] = useState(() => searchParams.get("updated") === "1");
  useEffect(() => {
    if (showCreatedMessage) showToast("Fascicolo creato.");
    if (showUpdatedMessage) showToast("Fascicolo aggiornato.");
    if (showCreatedMessage || showUpdatedMessage) router.replace(`/dossiers/${dossierId}`);
  }, [showCreatedMessage, showUpdatedMessage, router, showToast, dossierId]);

  async function handleToggleStatus() {
    if (!dossier) return;
    setBusy(true);
    setError(null);
    try {
      const next = dossier.status === "open" ? "closed" : "open";
      await setDossierStatus(supabase, dossierId, next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare lo stato.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!dossier) return;
    if (
      !window.confirm(
        `Eliminare il fascicolo "${dossier.title}"? I documenti collegati non verranno eliminati, solo scollegati.`,
      )
    )
      return;

    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await deleteDossier(supabase, user.id, dossierId);
      router.push("/dossiers?deleted=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il fascicolo.");
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  if (!dossier) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/dossiers"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna ai fascicoli
        </Link>
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Fascicolo non trovato.
        </p>
      </div>
    );
  }

  const linkedDocuments = documents.filter((doc) => doc.dossierId === dossierId);
  const timeline = buildDossierTimeline(linkedDocuments);
  const total = dossierTotalAmount(linkedDocuments);
  const isClosed = dossier.status === "closed";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dossiers"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna ai fascicoli
        </Link>
        <h1 className="mt-2 flex min-w-0 items-start gap-2 text-2xl font-semibold tracking-tight text-brand">
          <span aria-hidden="true">{isClosed ? "🗂️" : "📂"}</span>
          <span className="min-w-0 break-words">{dossier.title}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {isClosed ? `Chiuso il ${formatDate(dossier.closedAt!)}` : "Aperto"} · creato il{" "}
          {formatDate(dossier.createdAt)}
        </p>
        {dossier.description ? (
          <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {dossier.description}
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/dossiers/${dossierId}/edit`}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          Modifica
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={handleToggleStatus}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {isClosed ? "Riapri fascicolo" : "Chiudi fascicolo"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Elimina
        </button>
      </div>

      <section
        aria-label="Cronologia"
        className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cronologia</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Totale: <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {total ? formatAmount(total) : "—"}
            </span>
          </p>
        </div>

        {timeline.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessun documento collegato. Aprine uno in Archivio e scegli questo fascicolo dal campo
            &laquo;Fascicolo&raquo;.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {timeline.map(({ document, date, dateIsFromDocument }) => (
              <li key={document.id} className="flex items-center justify-between gap-3 py-2">
                <Link
                  href={`/archive/${document.id}`}
                  className="min-w-0 truncate text-sm text-zinc-900 hover:text-brand dark:text-zinc-100"
                >
                  {CONTENT_KIND_ICON[contentKindFor(document.mimeType)]} {document.filename}
                </Link>
                <span
                  className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400"
                  title={dateIsFromDocument ? "Data letta nel documento" : "Data di caricamento"}
                >
                  {formatDate(date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
