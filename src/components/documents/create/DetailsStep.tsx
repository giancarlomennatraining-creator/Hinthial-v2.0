import {
  DocumentMetadataFields,
  type DocumentMetadataFieldsValue,
} from "@/components/documents/DocumentMetadataFields";
import type { GroupChoices } from "@/components/documents/create/useCreateSubmit";
import type { FileLot } from "@/components/documents/create/useFileLot";
import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { DossierListItem } from "@/domain/dossiers/types";

/** Passo 3: categoria, bene, fascicoli e note, uguali per tutti i file, e i fascicoli che Hinthial propone per i file con lo stesso nome. */
export function DetailsStep({
  isUpload,
  fileCount,
  categories,
  assets,
  dossiers,
  metadata,
  onMetadataChange,
  proposedGroups,
  groupChoices,
  onGroupChoicesChange,
}: {
  isUpload: boolean;
  fileCount: number;
  categories: Category[];
  assets: AssetListItem[];
  dossiers: DossierListItem[];
  metadata: DocumentMetadataFieldsValue;
  onMetadataChange: (value: DocumentMetadataFieldsValue) => void;
  proposedGroups: FileLot["proposedGroups"];
  groupChoices: GroupChoices;
  onGroupChoicesChange: (update: (prev: GroupChoices) => GroupChoices) => void;
}) {
  return (
    <>
      {isUpload && fileCount > 1 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Questi dettagli valgono per tutti i {fileCount} file.
        </p>
      ) : null}
      <DocumentMetadataFields
        idPrefix="upload"
        categories={categories}
        assets={assets}
        dossiers={dossiers}
        value={metadata}
        onChange={onMetadataChange}
        // Scadenza ed emittente non si chiedono più qui: emergono come proposta dopo il salvataggio (v. passi post-salvataggio).
        showExpiry={false}
        showIssuer={false}
      />
      {isUpload
        ? proposedGroups.map((group) => {
            const key = group.label as string;
            const choice = groupChoices[key] ?? { link: true, title: group.proposedDossierTitle ?? "" };
            return (
              <label
                key={key}
                className="flex items-start gap-2 rounded-card border border-brand/30 bg-brand/5 p-4 text-sm"
              >
                <input
                  type="checkbox"
                  checked={choice.link}
                  onChange={(e) => onGroupChoicesChange((prev) => ({ ...prev, [key]: { ...choice, link: e.target.checked } }))}
                  className="mt-0.5"
                />
                <span>
                  {group.existingDossier ? (
                    <>
                      {group.files.length === 1 ? "Questo documento sembra" : `Questi ${group.files.length} documenti sembrano`}{" "}
                      appartenere a &laquo;{group.existingDossier.title}&raquo; (stesso nome: {key}). Aggiungerli?
                    </>
                  ) : (
                    <>
                      Questi {group.files.length} documenti hanno lo stesso nome ({key}) e sembrano la stessa
                      vicenda. Vuoi creare il fascicolo{" "}
                      <input
                        type="text"
                        value={choice.title}
                        disabled={!choice.link}
                        onChange={(e) => onGroupChoicesChange((prev) => ({ ...prev, [key]: { ...choice, title: e.target.value } }))}
                        aria-label="Titolo del fascicolo proposto"
                        className="mx-1 rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-sm text-zinc-950 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                      />
                      ?
                    </>
                  )}
                </span>
              </label>
            );
          })
        : null}
    </>
  );
}
