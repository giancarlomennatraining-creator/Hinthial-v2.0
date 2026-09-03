/**
 * Joins class name fragments, filtering out falsy values.
 *
 * Small utility used across UI components; kept dependency-free for the
 * bootstrap phase instead of pulling in clsx/tailwind-merge.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Returns a new array sorted A→Z (locale-aware, case-insensitive) by a
 * label derived from each item. Used for every dropdown/selection list
 * in the app --- main list views keep their own order (usually most
 * recent first); this is only for `<select>` options, so a returning
 * user always finds things where they expect them.
 */
export function sortAlphabetically<T>(items: T[], getLabel: (item: T) => string): T[] {
  return [...items].sort((a, b) =>
    getLabel(a).localeCompare(getLabel(b), "it", { sensitivity: "base" }),
  );
}

/** Filesystem-hostile characters replaced (one at a time, no regex backslash-escaping needed) so the name is safe as a downloaded file on any OS. */
export function sanitizeFilename(name: string): string {
  const forbidden = ["/", String.fromCharCode(92), ":", "*", "?", '"', "<", ">", "|"];
  const cleaned = forbidden.reduce((acc, ch) => acc.split(ch).join("_"), name).trim();
  return cleaned || "file";
}
