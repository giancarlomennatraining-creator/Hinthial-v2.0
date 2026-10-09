/** Text filter for a list panel (Documenti, Beni, Scadenze, Amici, Capsule) --- filters what's already loaded and decrypted, no query. */
import { INPUT_FIELD } from "@/components/ui/styles";
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={`min-w-[12rem] flex-1 ${INPUT_FIELD}`}
    />
  );
}
