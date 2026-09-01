import { serializeCsv } from "@/domain/import/csv";
import type { ImportKind, ImportKindSpec } from "@/domain/import/types";

export const IMPORT_KIND_SPECS: Record<ImportKind, ImportKindSpec> = {
  contacts: {
    kind: "contacts",
    label: "Contatti fiduciari",
    filenamePrefix: "contatti-fiduciari",
    columns: [
      {
        key: "name",
        label: "Nome",
        required: true,
        description: "Nome e cognome del contatto.",
        example: "Maria Rossi",
      },
      {
        key: "email",
        label: "Email",
        required: true,
        description: "Indirizzo email del contatto.",
        example: "maria.rossi@esempio.it",
      },
      {
        key: "role",
        label: "Ruolo",
        required: true,
        description: "La relazione con te (es. Coniuge, Avvocato, Fratello), testo libero.",
        example: "Coniuge",
      },
    ],
  },
  assets: {
    kind: "assets",
    label: "Asset",
    filenamePrefix: "asset",
    columns: [
      {
        key: "name",
        label: "Nome",
        required: true,
        description: "Nome dell'asset.",
        example: "Appartamento Milano",
      },
      {
        key: "category",
        label: "Categoria",
        required: false,
        description:
          "Nome di una categoria già esistente in HINTHIAL. Lascia vuoto se non si applica: se scrivi una categoria che non esiste ancora, potrai crearla al momento durante l'anteprima.",
        example: "Immobili",
      },
    ],
  },
  reminders: {
    kind: "reminders",
    label: "Scadenze",
    filenamePrefix: "scadenze",
    columns: [
      {
        key: "title",
        label: "Titolo",
        required: true,
        description: "Descrizione della scadenza.",
        example: "Rinnovo assicurazione auto",
      },
      {
        key: "dueAt",
        label: "Data scadenza",
        required: true,
        description: "Formato GG/MM/AAAA oppure AAAA-MM-GG.",
        example: "15/03/2027",
      },
      {
        key: "asset",
        label: "Asset collegato",
        required: false,
        description:
          "Nome di un asset già esistente in HINTHIAL, se questa scadenza è legata a uno (lascia vuoto altrimenti). Se scrivi un asset che non esiste ancora, potrai crearlo al momento durante l'anteprima. Le scadenze legate a un documento non si importano qui: nasceranno automaticamente quando HINTHIAL AI saprà leggere i documenti caricati.",
        example: "Auto Panda",
      },
    ],
  },
};

/** Header row + one example row, ready to hand to a download --- `;`-delimited, as Excel in an Italian locale expects. */
export function generateTemplateCsv(kind: ImportKind): string {
  const spec = IMPORT_KIND_SPECS[kind];
  return serializeCsv([spec.columns.map((c) => c.label), spec.columns.map((c) => c.example)], ";");
}

export function templateFilename(kind: ImportKind): string {
  return `hinthial-template-${IMPORT_KIND_SPECS[kind].filenamePrefix}.csv`;
}
