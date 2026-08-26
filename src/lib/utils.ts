/**
 * Joins class name fragments, filtering out falsy values.
 *
 * Small utility used across UI components; kept dependency-free for the
 * bootstrap phase instead of pulling in clsx/tailwind-merge.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
