import { FileDropZone } from "@/components/documents/FileDropZone";
import { FileReadingStatus } from "@/components/documents/create/FileReadingStatus";
import type { FileLot } from "@/components/documents/create/useFileLot";
import { formatSize } from "@/lib/format";
import { INPUT_FIELD } from "@/components/ui/styles";

/** Passo 2 per "Carica un file": la zona di rilascio, la scheda dei file scelti (con doppioni e titoli) e il titolo unico. */
export function UploadContent({
  fileLot,
  title,
  onTitleChange,
  isImage,
  creating,
}: {
  fileLot: FileLot;
  title: string;
  onTitleChange: (title: string) => void;
  isImage: boolean;
  creating: boolean;
}) {
  const {
    fileInputRef,
    lot,
    zoneSettled,
    zoneState,
    zoneProgress,
    duplicates,
    updateLotFile,
    addFiles,
    removeFile,
    handleCameraClick,
    handleFileInputBlur,
  } = fileLot;

  return (
    <div className="flex flex-col gap-3">
      {lot.length > 0 && zoneSettled ? (
        <div className="flex flex-col gap-2">
          {lot.map((item, index) => {
            const duplicate = duplicates[index];
            return (
              <div key={item.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="text-xl" aria-hidden="true">
                    {item.file.type.startsWith("image/") ? "🖼️" : "📄"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {item.file.name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatSize(item.file.size)}
                    </p>
                  </div>
                  <FileReadingStatus reading={item.reading} />
                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    aria-label={lot.length === 1 ? "Rimuovi file" : `Rimuovi ${item.file.name}`}
                    className="shrink-0 rounded-full p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    ×
                  </button>
                </div>
                {lot.length > 1 ? (
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateLotFile(item.id, { title: e.target.value })}
                    placeholder="Titolo (facoltativo)"
                    aria-label={`Titolo per ${item.file.name}`}
                    className={`w-full ${INPUT_FIELD}`}
                  />
                ) : null}
                {duplicate ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    <span>
                      🔁 Sembra già presente in Hinthial come &laquo;{duplicate.filename}&raquo;
                      {duplicate.createdAt
                        ? `, caricato il ${new Date(duplicate.createdAt).toLocaleDateString("it-IT")}`
                        : " (in questo stesso lotto)"}
                      — stesso nome, stessa dimensione.
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      className="shrink-0 font-medium underline-offset-2 hover:underline"
                    >
                      Escludi dall&apos;importazione
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {lot.length > 1 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {lot.length} file
              {duplicates.filter(Boolean).length > 0
                ? `, ${duplicates.filter(Boolean).length} possibile ${duplicates.filter(Boolean).length === 1 ? "duplicato" : "duplicati"}`
                : ""}
              . Hinthial li ha letti sul dispositivo, uno alla volta.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-4">
            <label className="w-fit cursor-pointer text-sm font-medium text-accent hover:underline">
              ＋ Aggiungi altri file
              <input
                type="file"
                multiple
                className="sr-only"
                aria-label="Aggiungi altri file"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          {/* Concept "Mirino" (v. FileDropZone): un'unica superficie, zona di rilascio e "clicca per scegliere"
        insieme; il campo vero la ricopre, invisibile ma presente. Resta visibile anche mentre i file si leggono. */}
          <FileDropZone
            inputRef={fileInputRef}
            state={zoneState}
            progress={zoneProgress}
            onFiles={(files) => addFiles(files)}
            onInputBlur={handleFileInputBlur}
          />
          {/* Solo su smartphone --- su desktop capture non ha effetto e sarebbe ridondante. Fuori dal
        riquadro sopra: dentro, la casella invisibile ne intercetterebbe il click. */}
          <button
            type="button"
            onClick={handleCameraClick}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 md:hidden dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            📷 Scatta foto
          </button>
        </div>
      )}

      {/* FASE 17c: detto prima è un'attesa annunciata, scoperto dopo è un'app lenta. */}
      {isImage && !creating ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Hinthial leggerà il testo scritto dentro
          {lot.length > 1 ? " le immagini" : " l'immagine"}, sul tuo dispositivo, per renderlo
          cercabile. Può richiedere qualche decina di secondi.
        </p>
      ) : null}

      {/* FASE 19b: "scan_0012.pdf" e "IMG_4821.jpg" sono il motivo per cui poi non si ritrova niente. Con più file ognuno ha il suo titolo, nella sua riga. */}
      {lot.length <= 1 ? (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="upload-title"
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Titolo
          </label>
          <input
            id="upload-title"
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={
              lot[0]?.file.name ?? "es. Polizza auto 2026"
            }
            className={`w-full ${INPUT_FIELD}`}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Lascia vuoto per usare il nome del file.
          </p>
        </div>
      ) : null}
    </div>
  );
}
