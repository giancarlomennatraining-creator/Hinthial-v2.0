"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { listDossiers } from "@/domain/dossiers/repository";
import { listDocumentSummaries } from "@/domain/documents/repository";
import { createDossierShare, listDossierShares, revokeDossierShare, type DossierShare } from "@/domain/dossiers/shares-repository";
import {
  MAX_SHARE_DOCUMENTS,
  MAX_SHARE_LABEL_LENGTH,
  SHARE_AUDIENCES,
  SHARE_EXPIRY_OPTIONS,
  mailtoUrl,
  shareStatus,
  summarizeAccesses,
  validateShareSelection,
  type ShareExpiryId,
} from "@/domain/dossiers/sharing";
import { CONTENT_KIND_ICON, contentKindFor } from "@/lib/content-kind";
import { formatDate, formatSize } from "@/lib/format";
import { useToast } from "@/components/ui/ToastProvider";
import { CARD, CARD_TITLE, SMALL_BUTTON, TEXT_INPUT } from "@/components/dossiers/styles";
import type { DossierListItem } from "@/domain/dossiers/types";
import type { DocumentSummary } from "@/domain/documents/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const OPTION_BASE = "flex cursor-pointer items-start gap-2.5 rounded-xl border-[1.5px] px-3.5 py-2.5 text-sm";

/**
 * Condividere un fascicolo con un professionista: si scelgono i documenti, per chi e per quanto tempo, e nasce un link
 * protetto. I documenti si ricifrano sul dispositivo con una chiave nuova che sta solo nel link (dopo il #): il server non
 * la vede mai. Il link si chiude da solo alla scadenza e si può revocare quando si vuole.
 */
export function ShareDossierForm({ masterKey, dossierId }: { masterKey: CryptoKey; dossierId: string }) {
  const supabase = useSupabase();
  const showToast = useToast();

  const [dossier, setDossier] = useState<DossierListItem | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [shares, setShares] = useState<DossierShare[]>([]);
  const [now] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [label, setLabel] = useState("");
  const [expiryId, setExpiryId] = useState<ShareExpiryId>("7d");
  const [allowDownload, setAllowDownload] = useState(false);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includePhase, setIncludePhase] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [created, setCreated] = useState<{ url: string; expiresAt: string; label: string; title: string } | null>(null);
  const [busyShareId, setBusyShareId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [dossiers, summaries, sharesResult] = await Promise.all([
        listDossiers(supabase, masterKey),
        listDocumentSummaries(supabase, masterKey),
        listDossierShares(supabase, masterKey, dossierId, window.location.origin).catch((): DossierShare[] => []),
      ]);
      setDossier(dossiers.find((d) => d.id === dossierId) ?? null);
      setDocuments(summaries.filter((d) => d.dossierIds.includes(dossierId)));
      setShares(sharesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare il fascicolo.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey, dossierId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  if (!dossier) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/dossiers" className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400">
          ← Torna ai fascicoli
        </Link>
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Fascicolo non trovato.
        </p>
      </div>
    );
  }

  // Di default tutti i documenti del fascicolo (fino al massimo consentito): chi condivide toglie ciò che non va mostrato.
  const selectedIds = selected ?? new Set(documents.slice(0, MAX_SHARE_DOCUMENTS).map((d) => d.id));
  const chosen = documents.filter((d) => selectedIds.has(d.id));
  const problem = validateShareSelection(chosen);
  const creating = progress !== null;
  const audience = label.trim() || "chi riceve il link";

  function toggleDocument(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  async function handleCreate() {
    if (!dossier || problem) return;
    setError(null);
    setProgress({ done: 0, total: chosen.length + 1 });
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      const result = await createDossierShare(
        supabase,
        masterKey,
        user.id,
        {
          dossier,
          documents: chosen,
          label,
          expiryId,
          allowDownload,
          includeSummary: includeSummary && dossier.summary !== null,
          includePhase: includePhase && dossier.phases !== null,
          origin: window.location.origin,
        },
        (done, total) => setProgress({ done, total }),
      );
      setCreated({ url: result.url, expiresAt: result.expiresAt, label: label.trim(), title: dossier.title });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile creare il link.");
    } finally {
      setProgress(null);
    }
  }

  async function handleCopy(url: string) {
    showToast((await copyText(url)) ? "Link copiato." : "Non riesco a copiarlo: selezionalo e copialo a mano.");
  }

  async function handleRevoke(share: DossierShare) {
    if (!window.confirm("Revocare questo link? Chi lo ha non potrà più aprire il fascicolo.")) return;
    setBusyShareId(share.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await revokeDossierShare(supabase, user.id, dossierId, share.id);
      if (created && share.url === created.url) setCreated(null);
      await refresh();
      showToast("Link revocato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile revocare il link.");
    } finally {
      setBusyShareId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 text-[#121a35] dark:text-zinc-100">
      <div className="flex flex-col gap-1.5">
        <Link href={`/dossiers/${dossierId}`} className="self-start text-[13.5px] font-bold text-brand underline-offset-2 hover:underline">
          ← {dossier.title}
        </Link>
        <h1 className="font-heading text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-brand">Condividi un fascicolo</h1>
        <p className="max-w-2xl text-sm text-[#5b6483] dark:text-zinc-400">
          Scegli cosa mostrare, a chi e per quanto tempo. Il link si chiude da solo, e lo puoi revocare quando vuoi.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section aria-label="Cosa condividi" className={CARD}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={CARD_TITLE}>Cosa condividi</h2>
              <span className="flex items-center gap-3 text-xs text-[#5b6483] dark:text-zinc-400">
                {chosen.length} di {documents.length} documenti
                <button type="button" onClick={() => setSelected(new Set(documents.slice(0, MAX_SHARE_DOCUMENTS).map((d) => d.id)))} className="font-bold text-brand hover:underline">
                  Tutti
                </button>
                <button type="button" onClick={() => setSelected(new Set())} className="font-bold text-brand hover:underline">
                  Nessuno
                </button>
              </span>
            </div>
            {documents.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Questo fascicolo non ha ancora documenti da condividere.</p>
            ) : (
              <ul className="flex flex-col">
                {documents.map((doc) => (
                  <li key={doc.id} className="border-t border-[#eef0f8] first:border-t-0 dark:border-zinc-900">
                    <label className="flex cursor-pointer items-center gap-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={(e) => toggleDocument(doc.id, e.target.checked)}
                        aria-label={`Condividi ${doc.filename}`}
                        className="h-4 w-4 shrink-0 accent-brand"
                      />
                      <span aria-hidden="true">{CONTENT_KIND_ICON[contentKindFor(doc.mimeType)]}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-semibold break-words">{doc.filename}</span>
                        <span className="text-xs text-[#5b6483] dark:text-zinc-400">
                          {formatSize(doc.size)} · {formatDate(doc.createdAt)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {documents.length > 0 && problem ? <p className="text-xs font-bold text-[#8a5a00]">{problem}</p> : null}
          </section>

          {dossier.summary || dossier.phases ? (
            <section aria-label="Altri dati" className={CARD}>
              <h2 className={CARD_TITLE}>Altri dati</h2>
              {dossier.summary ? (
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={includeSummary} onChange={(e) => setIncludeSummary(e.target.checked)} className="h-4 w-4 accent-brand" />
                  Includi il riassunto scritto da Hinthia
                </label>
              ) : null}
              {dossier.phases ? (
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={includePhase} onChange={(e) => setIncludePhase(e.target.checked)} className="h-4 w-4 accent-brand" />
                  Includi le fasi della vicenda
                </label>
              ) : null}
              <p className="text-xs text-[#8a91ad] dark:text-zinc-500">Persone coinvolte, passi e note personali non vengono mai condivisi.</p>
            </section>
          ) : null}

          <section aria-label="Con chi" className={CARD}>
            <h2 className={CARD_TITLE}>Con chi</h2>
            <div className="flex flex-wrap gap-2">
              {SHARE_AUDIENCES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setLabel(name)}
                  className="rounded-full border border-[#dfe3f0] bg-white px-3 py-1 text-xs font-bold text-[#3d4670] hover:border-brand dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                >
                  {name}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={label}
              maxLength={MAX_SHARE_LABEL_LENGTH}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Notaio Rossi"
              aria-label="Per chi è il link"
              className={TEXT_INPUT}
            />
            <p className="text-xs text-[#8a91ad] dark:text-zinc-500">Serve solo a riconoscere il link nell&apos;elenco: chi lo riceve non ne ha bisogno.</p>
          </section>

          <section aria-label="Per quanto tempo" className={CARD}>
            <h2 className={CARD_TITLE}>Per quanto tempo</h2>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Durata del link">
              {SHARE_EXPIRY_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`${OPTION_BASE} ${expiryId === option.id ? "border-brand bg-[#f3f6ff] dark:bg-brand/10" : "border-[#dfe3f0] dark:border-zinc-800"}`}
                >
                  <input type="radio" name="expiry" checked={expiryId === option.id} onChange={() => setExpiryId(option.id)} className="mt-0.5 accent-brand" />
                  {option.label}
                </label>
              ))}
            </div>
          </section>

          <section aria-label="Cosa può fare" className={CARD}>
            <h2 className={CARD_TITLE}>Cosa può fare</h2>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Permessi">
              <label className={`${OPTION_BASE} ${!allowDownload ? "border-brand bg-[#f3f6ff] dark:bg-brand/10" : "border-[#dfe3f0] dark:border-zinc-800"}`}>
                <input type="radio" name="permission" checked={!allowDownload} onChange={() => setAllowDownload(false)} className="mt-0.5 accent-brand" />
                <span>
                  <span className="font-bold">Solo vedere</span>
                  <span className="block text-xs text-[#5b6483] dark:text-zinc-400">
                    Apre i documenti nel browser, senza il pulsante per scaricarli. Non può impedire a chi li vede di salvarli in altri modi.
                  </span>
                </span>
              </label>
              <label className={`${OPTION_BASE} ${allowDownload ? "border-brand bg-[#f3f6ff] dark:bg-brand/10" : "border-[#dfe3f0] dark:border-zinc-800"}`}>
                <input type="radio" name="permission" checked={allowDownload} onChange={() => setAllowDownload(true)} className="mt-0.5 accent-brand" />
                <span>
                  <span className="font-bold">Vedere e scaricare</span>
                  <span className="block text-xs text-[#5b6483] dark:text-zinc-400">Può anche scaricare una copia di ogni documento.</span>
                </span>
              </label>
            </div>
          </section>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={creating || problem !== null}
              onClick={() => void handleCreate()}
              className="self-start rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {creating ? "Preparo il link…" : "Crea il link protetto"}
            </button>
            {progress ? (
              <div className="flex flex-col gap-1" role="status" aria-label="Avanzamento">
                <div className="h-1.5 max-w-sm overflow-hidden rounded-full bg-[#eef0f8] dark:bg-zinc-900">
                  <span className="block h-full rounded-full bg-brand transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
                <p className="text-xs text-[#5b6483] dark:text-zinc-400">
                  Cifro i documenti sul tuo dispositivo: {Math.min(progress.done, progress.total - 1)} di {progress.total - 1}
                </p>
              </div>
            ) : null}
          </div>

          {created ? (
            <section aria-label="Link pronto" className="flex flex-col gap-3 rounded-[18px] border border-[#bfe3d2] bg-[#e3f4ec] p-4 dark:border-emerald-900 dark:bg-emerald-950">
              <h2 className="font-heading text-base font-extrabold text-[#14604a] dark:text-emerald-200">
                Link pronto per {created.label || "chi lo riceve"}
              </h2>
              <input
                readOnly
                value={created.url}
                aria-label="Link di condivisione"
                onFocus={(e) => e.currentTarget.select()}
                className={`${TEXT_INPUT} font-mono text-xs`}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleCopy(created.url)} className="rounded-[10px] bg-brand px-3.5 py-2 text-[13px] font-bold text-white hover:bg-brand-hover">
                  Copia
                </button>
                <a href={mailtoUrl({ label: created.label, title: created.title, url: created.url, expiresAt: created.expiresAt })} className={SMALL_BUTTON}>
                  Invia per email
                </a>
              </div>
              <p className="text-xs text-[#14604a] dark:text-emerald-300">
                La chiave per aprire i documenti sta nel link, dopo il simbolo #: non arriva mai ai nostri server. Chi non ha il link intero non
                vede niente, nemmeno noi. Il link vale fino al {formatDate(created.expiresAt)}.
              </p>
            </section>
          ) : null}
        </div>

        <aside aria-label={`Cosa vedrà ${audience}`} className="flex w-full shrink-0 flex-col gap-3 lg:w-[300px]">
          <div className={CARD}>
            <h2 className={CARD_TITLE}>Cosa vedrà {audience}</h2>
            <p className="text-sm font-bold break-words">{dossier.title}</p>
            <p className="text-xs text-[#5b6483] dark:text-zinc-400">
              {chosen.length} {chosen.length === 1 ? "documento" : "documenti"} · {allowDownload ? "può scaricare" : "solo lettura"} · valido{" "}
              {SHARE_EXPIRY_OPTIONS.find((o) => o.id === expiryId)?.label}
            </p>
            <ul className="flex flex-col gap-1 text-[13px] text-[#3d4670] dark:text-zinc-300">
              {chosen.slice(0, 6).map((doc) => (
                <li key={doc.id} className="truncate">
                  {CONTENT_KIND_ICON[contentKindFor(doc.mimeType)]} {doc.filename}
                </li>
              ))}
              {chosen.length > 6 ? <li className="text-xs text-[#8a91ad]">e altri {chosen.length - 6}</li> : null}
            </ul>
          </div>
        </aside>
      </div>

      <section aria-label="Link condivisi" className={CARD}>
        <h2 className={CARD_TITLE}>Link condivisi</h2>
        {shares.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Non hai ancora condiviso questo fascicolo con nessuno.</p>
        ) : (
          <ul className="flex flex-col">
            {shares.map((share) => {
              const status = shareStatus(share, now);
              const summary = summarizeAccesses(share.accesses);
              return (
                <li key={share.id} className="flex flex-col gap-2 border-t border-[#eef0f8] py-3 first:border-t-0 first:pt-0 dark:border-zinc-900">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-bold">{share.label || "Link senza nome"}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        status === "active" ? "bg-[#e3f4ec] text-[#1c7c5a]" : "bg-[#eceff4] text-[#5b6483] dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {status === "active" ? "Attivo" : status === "revoked" ? "Revocato" : "Scaduto"}
                    </span>
                    <span className="text-xs text-[#5b6483] dark:text-zinc-400">
                      {share.documentCount} {share.documentCount === 1 ? "documento" : "documenti"} · {share.allowDownload ? "vede e scarica" : "solo lettura"} ·
                      creato il {formatDate(share.createdAt)} · {status === "active" ? `scade il ${formatDate(share.expiresAt)}` : ""}
                    </span>
                  </div>
                  <p className="text-xs text-[#5b6483] dark:text-zinc-400">
                    {summary.opens === 0
                      ? "Nessuno ha ancora aperto il link."
                      : `Aperto ${summary.opens} ${summary.opens === 1 ? "volta" : "volte"} · ${summary.documentsSeen} ${
                          summary.documentsSeen === 1 ? "documento visto" : "documenti visti"
                        } · ultimo accesso ${summary.lastAt ? formatDateTime(summary.lastAt) : ""}`}
                  </p>
                  {status === "active" ? (
                    <div className="flex flex-wrap gap-2">
                      {share.url ? (
                        <button type="button" onClick={() => void handleCopy(share.url as string)} className={SMALL_BUTTON}>
                          Copia il link
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyShareId === share.id}
                        onClick={() => void handleRevoke(share)}
                        className="rounded-[10px] border border-red-300 bg-white px-3 py-2 text-[13px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950"
                      >
                        Revoca subito
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
