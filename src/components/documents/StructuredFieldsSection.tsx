"use client";

import type {
  StructuredField,
  StructuredFieldKind,
} from "@/domain/extraction/structured-fields";
import { formatDate } from "@/lib/format";

/**
 * FASE 18 --- "Cosa ne ho ricavato": i campi che Hinthial ha riconosciuto
 * dentro il testo di un documento.
 *
 * Sta **sopra** "Cosa ho letto" di proposito: quattro righe leggibili
 * valgono più di tremila caratteri di testo grezzo, e il testo integrale
 * qui sotto serve semmai a verificarle. Per lo stesso motivo ogni campo
 * mostra il pezzo di documento da cui viene: l'utente deve poter dare
 * ragione o torto a Hinthial in un colpo d'occhio, senza fidarsi.
 *
 * Non c'è nessun tasto per accettare, e non è una dimenticanza: la
 * scrittura automatica ha bisogno di accetta/modifica/rifiuta, della
 * memoria dei rifiuti e dell'annullamento --- cioè della FASE 19. Finché
 * quella non c'è, mostrare e basta è l'unico comportamento onesto, e la
 * riga in fondo lo dice all'utente invece di lasciarglielo intuire.
 */

const FIELD_LABEL: Record<StructuredFieldKind, string> = {
  "document-date": "Data del documento",
  expiry: "Scadenza",
  issuer: "Emittente",
  title: "Titolo",
};

const FIELD_ICON: Record<StructuredFieldKind, string> = {
  "document-date": "📅",
  expiry: "⏳",
  issuer: "🏛️",
  title: "🔖",
};

function displayValue(field: StructuredField): string {
  switch (field.kind) {
    case "document-date":
    case "expiry":
      return formatDate(field.value);
    case "issuer":
    case "title":
      return field.value;
  }
}

export function StructuredFieldsSection({ fields }: { fields: StructuredField[] }) {
  if (fields.length === 0) return null;

  return (
    <section aria-label="Cosa ne ho ricavato" className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Cosa ne ho ricavato
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">🔒 sul tuo dispositivo</p>
      </div>

      <ul className="flex flex-col gap-3">
        {fields.map((field) => (
          <li key={`${field.kind}-${field.value}`} className="flex gap-3">
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-base">
              {FIELD_ICON[field.kind]}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {FIELD_LABEL[field.kind]}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {displayValue(field)}
                </span>
                {/* Una scadenza calcolata da "controllo tra dodici mesi"
                    non è scritta da nessuna parte sul foglio: dirlo è la
                    differenza tra una proposta e un'affermazione. */}
                {field.derived ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    calcolata da Hinthial
                  </span>
                ) : null}
              </p>
              {/* L'emittente È la riga da cui viene: ripeterla sotto
                  sarebbe rumore, non una verifica. */}
              {field.context === field.value ? null : (
                <p className="mt-0.5 text-xs text-zinc-500 italic dark:text-zinc-400">
                  {field.context}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Per ora te le mostro soltanto: non ho cambiato niente nella scheda qui sopra.
      </p>
    </section>
  );
}
