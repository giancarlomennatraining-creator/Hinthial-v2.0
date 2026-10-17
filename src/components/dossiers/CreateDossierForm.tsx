"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { addExpectedItem, createDossier, replaceDocumentDossierLinks, setDossierPhases } from "@/domain/dossiers/repository";
import { listDocumentSummaries } from "@/domain/documents/repository";
import { MAX_PHASE_NAME_LENGTH, MAX_PHASES, normalizePhases, parsePhaseNames } from "@/domain/dossiers/phases";
import { DOSSIER_TEMPLATES, filterTemplates, findTemplateMatches, type DossierTemplate, type TemplateMatch } from "@/domain/dossiers/templates";
import { CARD, CARD_TITLE, TEXT_INPUT } from "@/components/dossiers/styles";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_FIELD } from "@/components/ui/styles";

/**
 * Creazione di un fascicolo: da zero (solo titolo e descrizione, lo stato nasce "aperto") oppure da un modello, che
 * propone le fasi, i documenti che servono di solito e quelli già in Hinthial che sembrano appartenerci. Tutto si può
 * cambiare prima di creare, e poi dalla scheda. I documenti si collegano anche dal loro form (campo "Fascicolo").
 */
export function CreateDossierForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [template, setTemplate] = useState<DossierTemplate | null>(null);
  // Ciò che si scrive in "Cosa sta succedendo?": filtra l'elenco dei modelli.
  const [query, setQuery] = useState("");
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

  const visibleTemplates = filterTemplates(DOSSIER_TEMPLATES, query);
  const phaseNames = parsePhaseNames(phasesText);
  const chosenExpected = template ? template.expected.filter((l) => !skippedExpected.has(l)).length : 0;

  return (
    <div className="flex flex-col gap-6 text-zinc-900 dark:text-zinc-100">
      <div>
        <Link
          href="/dossiers"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna ai fascicoli
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-title">Nuovo fascicolo</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Una vicenda che attraversa più categorie — un problema di salute, l&apos;acquisto di una casa, un incidente. Parti da
          una vicenda che conosci: ti diciamo quali documenti servono di solito e cerchiamo quelli che hai già.
        </p>
      </div>

      <section aria-label="Modelli" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="template-search" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Cosa sta succedendo?
          </label>
          <input
            id="template-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Con un solo modello rimasto, Invio lo sceglie (e non invia il modulo).
              if (e.key === "Enter") {
                e.preventDefault();
                if (visibleTemplates.length === 1) void handlePick(visibleTemplates[0]);
              }
            }}
            placeholder="es. mutuo, ginocchio, eredità…"
            className={INPUT_FIELD}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
          <div role="radiogroup" aria-label="Modello" className="flex min-w-0 flex-col gap-0.5 rounded-[14px] border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-950">
            {visibleTemplates.map((item) => {
              const active = template?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => void handlePick(item)}
                  className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors ${
                    active ? "bg-brand/10 dark:bg-brand/15" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: item.tint }} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={item.icon} />
                    </svg>
                  </span>
                  <span className={`min-w-0 flex-1 font-heading text-[14.5px] leading-tight font-extrabold ${active ? "text-accent" : ""}`}>{item.name}</span>
                </button>
              );
            })}
            {visibleTemplates.length === 0 ? (
              <p className="px-2.5 py-2 text-sm text-zinc-500 dark:text-zinc-400">Nessun modello per “{query.trim()}”.</p>
            ) : null}
            <button
              type="button"
              role="radio"
              aria-checked={template === null}
              onClick={() => void handlePick(null)}
              className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors ${
                template === null ? "bg-brand/10 dark:bg-brand/15" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-zinc-50 dark:bg-zinc-900" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--n-500)" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className={`min-w-0 flex-1 font-heading text-[14.5px] leading-tight font-extrabold ${template === null ? "text-accent" : ""}`}>Parti da zero</span>
            </button>
          </div>

          <div aria-live="polite" className="flex min-w-0 flex-col gap-4 rounded-[14px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            {template ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px]" style={{ background: template.tint }} aria-hidden="true">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={template.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={template.icon} />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-heading text-xl leading-tight font-extrabold">{template.name}</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{template.description}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400">Le fasi, in ordine</h3>
                  <ol className="flex overflow-x-auto">
                    {template.phases.map((phase) => (
                      <li
                        key={phase}
                        className="relative min-w-[84px] flex-1 pt-[22px] text-[12.5px] font-bold before:absolute before:left-0 before:right-0 before:top-[5px] before:h-0.5 before:bg-zinc-200 after:absolute after:left-0 after:top-0 after:h-3 after:w-3 after:rounded-full after:border-[2.5px] after:border-brand after:bg-white last:before:right-1/2 dark:before:bg-zinc-800 dark:after:bg-zinc-950"
                      >
                        {phase}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400">Documenti che servono di solito</h3>
                  <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{template.expected.join(" · ")}</p>
                </div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Cercherò tra i tuoi documenti quelli che sembrano già appartenere a questa vicenda. Fasi e documenti si cambiano più sotto.
                </p>
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-xl leading-tight font-extrabold">Parti da zero</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Un fascicolo vuoto: solo titolo e descrizione. Le fasi e i documenti attesi li aggiungi tu quando ti servono.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-4 rounded-card border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950"
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
            className={INPUT_FIELD}
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
            className={INPUT_FIELD}
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Separale con una virgola, in ordine. Al massimo {MAX_PHASES} fasi di {MAX_PHASE_NAME_LENGTH} lettere. Ne hai {phaseNames.length}.
              </p>
            </section>

            <section aria-label="Documenti attesi" className={CARD}>
              <div className="flex items-baseline justify-between">
                <h2 className={CARD_TITLE}>Documenti attesi</h2>
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{chosenExpected} scelti</span>
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
              <p className="text-[11.5px] leading-snug text-zinc-400 dark:text-zinc-500">
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
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Sembra: {match.expectedLabel}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="text-[11.5px] leading-snug text-zinc-400 dark:text-zinc-500">
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
            className={`${BTN_PRIMARY} disabled:opacity-50`}
          >
            {creating ? "Creazione…" : "Crea fascicolo"}
          </button>
          <Link
            href="/dossiers"
            className={BTN_SECONDARY}
          >
            Annulla
          </Link>
        </div>
      </form>
    </div>
  );
}
