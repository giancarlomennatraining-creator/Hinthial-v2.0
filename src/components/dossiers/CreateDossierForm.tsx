"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { addExpectedItem, createDossier, replaceDocumentDossierLinks, setDossierPhases } from "@/domain/dossiers/repository";
import { listDocumentSummaries } from "@/domain/documents/repository";
import { MAX_PHASE_NAME_LENGTH, MAX_PHASES, normalizePhases, parsePhaseNames } from "@/domain/dossiers/phases";
import { DOSSIER_TEMPLATES, findTemplateMatches, templateMeta, type DossierTemplate, type TemplateMatch } from "@/domain/dossiers/templates";
import { CARD, CARD_TITLE, TEXT_INPUT } from "@/components/dossiers/styles";

/**
 * Creazione di un fascicolo: da zero (solo titolo e descrizione, lo stato nasce "aperto") oppure da un modello, che
 * propone le fasi, i documenti che servono di solito e quelli già in Hinthial che sembrano appartenerci. Tutto si può
 * cambiare prima di creare, e poi dalla scheda. I documenti si collegano anche dal loro form (campo "Fascicolo").
 */
export function CreateDossierForm({ masterKey }: { masterKey: CryptoKey }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [template, setTemplate] = useState<DossierTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [phasesText, setPhasesText] = useState("");
  const [skippedExpected, setSkippedExpected] = useState<ReadonlySet<string>>(new Set());
  // I documenti si leggono la prima volta che si sceglie un modello: partire da zero non deve costare nulla.
  const [matches, setMatches] = useState<TemplateMatch[] | null>(null);
  const [skippedMatches, setSkippedMatches] = useState<ReadonlySet<string>>(new Set());
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [loadedDocuments, setLoadedDocuments] = useState<Awaited<ReturnType<typeof listDocumentSummaries>> | null>(null);

  async function handlePick(next: DossierTemplate | null) {
    setTemplate(next);
    setSkippedExpected(new Set());
    setSkippedMatches(new Set());
    if (!next) {
      setPhasesText("");
      if (!titleTouched) setTitle("");
      setMatches(null);
      return;
    }
    setPhasesText(next.phases.join(", "));
    if (!titleTouched) setTitle(next.name);

    let documents = loadedDocuments;
    if (!documents) {
      setMatchesLoading(true);
      try {
        documents = await listDocumentSummaries(supabase, masterKey);
        setLoadedDocuments(documents);
      } catch {
        // Senza i documenti il modello funziona lo stesso: solo non propone quelli già presenti.
        documents = [];
      } finally {
        setMatchesLoading(false);
      }
    }
    setMatches(findTemplateMatches(next, documents));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Inserisci un titolo per il fascicolo.");
      return;
    }

    setCreating(true);
    let id: string | null = null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      id = await createDossier(supabase, masterKey, user.id, { title: trimmedTitle, description: description.trim() });

      if (template) {
        const phases = normalizePhases({ names: parsePhaseNames(phasesText), current: 0 });
        if (phases) await setDossierPhases(supabase, masterKey, id, phases);
        for (const label of template.expected.filter((l) => !skippedExpected.has(l))) {
          await addExpectedItem(supabase, masterKey, user.id, id, label);
        }
        // Nessuno dei documenti proposti sta già in un fascicolo (v. findTemplateMatches): il collegamento è solo questo.
        for (const match of (matches ?? []).filter((m) => !skippedMatches.has(m.documentId))) {
          await replaceDocumentDossierLinks(supabase, user.id, match.documentId, [id]);
        }
      }
      router.push(template ? `/dossiers/${id}?created=1` : "/dossiers?created=1");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossibile creare il fascicolo.";
      // Se il fascicolo c'è già, un secondo tentativo ne farebbe un doppione: si dice com'è andata e si offre di aprirlo.
      setError(id ? `Il fascicolo è stato creato, ma non ho potuto completarlo: ${message}` : message);
      setCreatedId(id);
      setCreating(false);
    }
  }

  const phaseNames = parsePhaseNames(phasesText);
  const chosenExpected = template ? template.expected.filter((l) => !skippedExpected.has(l)).length : 0;

  return (
    <div className="flex flex-col gap-6 text-[#121a35] dark:text-zinc-100">
      <div>
        <Link
          href="/dossiers"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna ai fascicoli
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand">Nuovo fascicolo</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Una vicenda che attraversa più categorie — un problema di salute, l&apos;acquisto di una casa, un incidente. Parti da
          una vicenda che conosci: ti diciamo quali documenti servono di solito e cerchiamo quelli che hai già.
        </p>
      </div>

      <section aria-label="Modelli" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {DOSSIER_TEMPLATES.map((item) => {
          const active = template?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => void handlePick(item)}
              className={`flex flex-col gap-2 rounded-[16px] border-[1.5px] bg-white p-3.5 text-left transition-all hover:-translate-y-0.5 dark:bg-zinc-950 ${
                active ? "border-brand shadow-[0_10px_26px_rgba(43,79,196,0.18)]" : "border-[#dfe3f0] shadow-[0_2px_8px_rgba(18,26,53,0.04)] dark:border-zinc-800"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: item.tint }} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
              </span>
              <span className="font-heading text-[15px] leading-tight font-extrabold">{item.name}</span>
              <span className="text-xs leading-snug text-[#5b6483] dark:text-zinc-400">{item.description}</span>
              <span className="text-[11.5px] font-bold text-[#8a91ad] dark:text-zinc-500">{templateMeta(item)}</span>
            </button>
          );
        })}
      </section>
      <button
        type="button"
        aria-pressed={template === null}
        onClick={() => void handlePick(null)}
        className={`self-start rounded-xl border-[1.5px] px-3.5 py-2 text-[13px] font-bold ${
          template === null ? "border-brand bg-[#f3f6ff] text-brand dark:bg-brand/10" : "border-dashed border-[#c9d0e6] text-brand dark:border-zinc-700"
        }`}
      >
        Parti da zero: solo un titolo e una descrizione
      </button>

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Titolo
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            placeholder="es. Intervento al ginocchio"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Descrizione
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Facoltativa: qualche riga per ricordarti di cosa si tratta."
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </div>

        {template ? (
          <>
            <section aria-label="Le fasi" className={CARD}>
              <h2 className={CARD_TITLE}>Le fasi</h2>
              <input
                type="text"
                value={phasesText}
                onChange={(e) => setPhasesText(e.target.value)}
                aria-label="Nomi delle fasi"
                className={TEXT_INPUT}
              />
              <p className="text-xs text-[#5b6483] dark:text-zinc-400">
                Separale con una virgola, in ordine. Al massimo {MAX_PHASES} fasi di {MAX_PHASE_NAME_LENGTH} lettere. Ne hai {phaseNames.length}.
              </p>
            </section>

            <section aria-label="Documenti attesi" className={CARD}>
              <div className="flex items-baseline justify-between">
                <h2 className={CARD_TITLE}>Documenti attesi</h2>
                <span className="text-xs font-bold text-[#5b6483] dark:text-zinc-400">{chosenExpected} scelti</span>
              </div>
              <ul className="flex flex-col gap-1">
                {template.expected.map((label) => (
                  <li key={label}>
                    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={!skippedExpected.has(label)}
                        onChange={(e) => {
                          const next = new Set(skippedExpected);
                          if (e.target.checked) next.delete(label);
                          else next.add(label);
                          setSkippedExpected(next);
                        }}
                        className="h-4 w-4 accent-brand"
                      />
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-[11.5px] leading-snug text-[#8a91ad] dark:text-zinc-500">
                Una voce si spunta da sola quando nel fascicolo c&apos;è un documento che la nomina.
              </p>
            </section>

            {matchesLoading ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Cerco tra i tuoi documenti…</p>
            ) : matches && matches.length > 0 ? (
              <section aria-label="Documenti già trovati" className={CARD}>
                <h2 className={CARD_TITLE}>
                  Ho già trovato {matches.length} {matches.length === 1 ? "documento" : "documenti"} tra i tuoi
                </h2>
                <ul className="flex flex-col gap-1">
                  {matches.map((match) => (
                    <li key={match.documentId}>
                      <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
                        <input
                          type="checkbox"
                          checked={!skippedMatches.has(match.documentId)}
                          onChange={(e) => {
                            const next = new Set(skippedMatches);
                            if (e.target.checked) next.delete(match.documentId);
                            else next.add(match.documentId);
                            setSkippedMatches(next);
                          }}
                          aria-label={`Collega ${match.filename}`}
                          className="h-4 w-4 accent-brand"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold break-words">{match.filename}</span>
                          <span className="text-xs text-[#5b6483] dark:text-zinc-400">Sembra: {match.expectedLabel}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="text-[11.5px] leading-snug text-[#8a91ad] dark:text-zinc-500">
                  Solo documenti che non stanno già in un fascicolo. Togli la spunta a quelli che non c&apos;entrano.
                </p>
              </section>
            ) : null}
          </>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}{" "}
            {createdId ? (
              <Link href={`/dossiers/${createdId}`} className="font-bold underline">
                Apri il fascicolo
              </Link>
            ) : null}
          </p>
        ) : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={creating || createdId !== null}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {creating ? "Creazione…" : "Crea fascicolo"}
          </button>
          <Link
            href="/dossiers"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Annulla
          </Link>
        </div>
      </form>
    </div>
  );
}
