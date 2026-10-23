import { cn } from "@/lib/utils";

/** "Caricamento…" mentre un elenco o un pannello aspetta i suoi dati: stesso testo e stesso grigio ovunque. */
export function LoadingText({
  children = "Caricamento…",
  size = "sm",
  className,
}: {
  children?: React.ReactNode;
  size?: "sm" | "xs";
  className?: string;
}) {
  return (
    <p className={cn(size === "xs" ? "text-xs" : "text-sm", "text-zinc-500 dark:text-zinc-400", className)}>{children}</p>
  );
}
