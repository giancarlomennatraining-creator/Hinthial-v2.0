import { inferFieldInputType } from "@/domain/structured-fields/value-type";
import type { FieldVocabularyEntry } from "@/domain/structured-fields/vocabulary";
import { DocumentMetadataFields, type DocumentMetadataFieldsValue } from "@/components/documents/DocumentMetadataFields";
import { INPUT_FIELD } from "@/components/ui/styles";
import type { Proposal } from "@/domain/proposals/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";
import type { DossierListItem } from "@/domain/dossiers/types";

/** Le voci del vocabolario sono scritte in minuscolo ("importo"): come etichetta di un campo vanno con la maiuscola, come le altre. */
function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Fusione Scheda/Modifica (v. feedback utente): niente più una pagina /edit a parte, i campi sono sempre modificabili
 * qui --- un "Salva modifiche" li mette via quando ce n'è bisogno.
 */
export function SchedaPanel({
  doc,
  categories,
  assets,
  dossiers,
  fieldVocabulary,
  acceptAllCandidates,
  proposalBusy,
  onAcceptAll,
  titleValue,
  onTitleChange,
  fields,
  onFieldsChange,
  structuredValues,
  onStructuredValuesChange,
}: {
  doc: DocumentListItem;
  categories: Category[];
  assets: AssetListItem[];
  dossiers: DossierListItem[];
  fieldVocabulary: FieldVocabularyEntry[];
  acceptAllCandidates: Proposal[];
  proposalBusy: boolean;
  onAcceptAll: (candidates: Proposal[]) => void;
  titleValue: string | null;
  onTitleChange: (value: string) => void;
  fields: DocumentMetadataFieldsValue | null;
  onFieldsChange: (value: DocumentMetadataFieldsValue) => void;
  structuredValues: Record<string, string> | null;
  onStructuredValuesChange: (values: Record<string, string>) => void;
}) {
  return (
    <div id="tabpanel-scheda" role="tabpanel" aria-labelledby="tab-scheda" className="flex flex-col gap-3">
      {acceptAllCandidates.length > 0 ? (
        <div
          role="group"
          aria-label="Informazioni trovate da Silva"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2"
        >
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {acceptAllCandidates.length === 1
              ? "Silva ha trovato 1 informazione da aggiungere alla Scheda."
              : `Silva ha trovato ${acceptAllCandidates.length} informazioni da aggiungere alla Scheda.`}
          </p>
          <button
            type="button"
            disabled={proposalBusy}
            onClick={() => onAcceptAll(acceptAllCandidates)}
            className="rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            Accetta tutto
          </button>
        </div>
      ) : null}
      {titleValue !== null ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="scheda-title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Titolo
          </label>
          <input
            id="scheda-title"
            type="text"
            value={titleValue}
            onChange={(e) => onTitleChange(e.target.value)}
            className={`w-full ${INPUT_FIELD}`}
          />
        </div>
      ) : null}
      {fields ? (
        <DocumentMetadataFields
          idPrefix="scheda"
          categories={categories}
          assets={assets}
          dossiers={dossiers}
          value={fields}
          onChange={onFieldsChange}
        />
      ) : null}
      {structuredValues && Object.keys(structuredValues).length > 0 ? (
        <div role="group" aria-labelledby="scheda-group-data" className="flex flex-col gap-3">
          <p id="scheda-group-data" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Dati del documento
          </p>
          {Object.entries(structuredValues).map(([key, value]) => {
            const inputId = `scheda-field-${key}`;
            return (
              <div key={key} className="flex flex-col gap-1">
                <label htmlFor={inputId} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {capitalizeFirst(fieldVocabulary.find((v) => v.fieldKey === key)?.label ?? key)}
                </label>
                {/* Il tipo segue il dato salvato, non quello che si sta digitando: una data si sceglie dal calendario. */}
                <input
                  id={inputId}
                  type={inferFieldInputType(doc.structuredFields[key] ?? value)}
                  value={value}
                  onChange={(e) => onStructuredValuesChange({ ...structuredValues, [key]: e.target.value })}
                  className={`w-full ${INPUT_FIELD}`}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
