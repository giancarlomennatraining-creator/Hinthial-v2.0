import { serializeCsv } from "@/domain/import/csv";
import type { ImportKind, ImportKindSpec } from "@/domain/import/types";

export const IMPORT_KIND_SPECS: Record<ImportKind, ImportKindSpec> = {
  friends: {
    kind: "friends",
    label: "Amici",
    filenamePrefix: "amici",
    columns: [
      {
        key: "name",
        label: "Nome",
        required: true,
        description: "Nome e cognome dell'amico.",
        example: "Maria Rossi",
      },
      {
        key: "email",
        label: "Email",
        required: true,
        description: "Indirizzo email dell'amico.",
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
    label: "Beni",
    filenamePrefix: "beni",
    columns: [
      {
        key: "name",
        label: "Nome",
        required: true,
        description: "Nome del bene.",
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
        label: "Bene collegato",
        required: false,
        description:
          "Nome di un bene già esistente in HINTHIAL, se questa scadenza è legata a uno (lascia vuoto altrimenti). Se scrivi un bene che non esiste ancora, potrai crearlo al momento durante l'anteprima. Le scadenze legate a un documento non si importano qui: nasceranno automaticamente quando HINTHIAL AI saprà leggere i documenti caricati.",
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
