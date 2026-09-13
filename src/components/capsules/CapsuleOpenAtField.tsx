"use client";

/**
 * La data e ora di apertura come una frase ("Si aprirà il ...") invece
 * di un campo anonimo in un riquadro --- v. richiesta utente, "capsule
 * come lettere". Un vero <input type="datetime-local"> (stesso
 * calendario+orologio nativo, stesso nome accessibile "Data e ora di
 * apertura" per chi usa uno screen reader o naviga da tastiera), solo
 * senza il riquadro grigio attorno: un sottolineato che si accende al
 * focus.
 *
 * `value`/`onChange` restano un ISO datetime (UTC) verso l'esterno,
 * come per ogni altra data dell'app --- la conversione da/verso il
 * formato locale "YYYY-MM-DDTHH:mm" richiesto da datetime-local resta
 * un dettaglio interno di questo componente, così i form che lo usano
 * non devono saperne nulla.
 */

/** ISO (UTC) -> "YYYY-MM-DDTHH:mm" in ora locale, il solo formato che datetime-local accetta come value. */
function toLocalInputValue(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" in ora locale (dall'input, interpretato come tale da JS) -> ISO (UTC). */
function toIsoValue(localValue: string): string {
  if (!localValue) return "";
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function CapsuleOpenAtField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-zinc-400 dark:text-zinc-500"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <line x1="8" y1="3" x2="8" y2="7" />
        <line x1="16" y1="3" x2="16" y2="7" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      Si aprirà il
      <input
        id={id}
        type="datetime-local"
        required
        aria-label="Data e ora di apertura"
        value={toLocalInputValue(value)}
        onChange={(e) => onChange(toIsoValue(e.target.value))}
        className="border-0 border-b border-dashed border-zinc-400 bg-transparent px-0.5 py-0 font-semibold text-zinc-900 focus:border-brand focus:outline-none dark:border-zinc-600 dark:text-zinc-50"
      />
    </div>
  );
}
