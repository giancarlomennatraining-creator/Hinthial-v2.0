import { CheckCircleIcon } from "@/components/icons/nav-icons";
import type { ReadingState } from "@/components/documents/create/create-model";

/** Segno accanto al file scelto --- sostituisce il vecchio blocco "Ho letto il documento": un segno, non un riquadro a sé. */
export function FileReadingStatus({ reading }: { reading: ReadingState }) {
  if (reading.status === "reading") {
    return (
      <span className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
        Lettura…
        {reading.progress === null
          ? ""
          : ` ${Math.round(reading.progress * 100)}%`}
      </span>
    );
  }
  if (reading.status === "skipped") {
    return (
      <span className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
        Non so ancora leggerlo
      </span>
    );
  }
  if (reading.status === "done") {
    return reading.text ? (
      <span className="flex items-center gap-1 text-xs font-medium whitespace-nowrap text-emerald-600 dark:text-emerald-400">
        <CheckCircleIcon width={14} height={14} /> Letto sul dispositivo
      </span>
    ) : (
      <span className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
        Nessun testo trovato
      </span>
    );
  }
  return null;
}
