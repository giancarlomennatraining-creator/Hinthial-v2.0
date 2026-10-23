import Link from "next/link";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/ui/styles";

/** In fondo al form: prima del salvataggio "Aggiungi" e "Annulla", dopo i due modi di proseguire. */
export function FormFooter({
  savedDocId,
  creating,
  canSubmit,
  submitLabel,
}: {
  savedDocId: string | null;
  creating: boolean;
  canSubmit: boolean;
  submitLabel: string;
}) {
  if (savedDocId) {
    return (
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/archive/${savedDocId}`}
          className={BTN_PRIMARY}
        >
          Vai alla scheda del documento →
        </Link>
        <Link
          href="/archive?created=1"
          className={BTN_SECONDARY}
        >
          Torna all&apos;archivio
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="submit"
        disabled={creating || !canSubmit}
        className={`${BTN_PRIMARY} w-full sm:w-auto disabled:opacity-50`}
      >
        {submitLabel}
      </button>
      <Link
        href="/archive"
        className="w-full rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100 sm:w-auto dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        Annulla
      </Link>
    </div>
  );
}
