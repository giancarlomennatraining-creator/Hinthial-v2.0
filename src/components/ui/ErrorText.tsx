import { cn } from "@/lib/utils";

/**
 * Un messaggio d'errore sotto un modulo o in cima a un elenco: rosso, e annunciato dagli screen reader (`role="alert"`).
 * Prima era lo stesso `<p role="alert" className="…">` scritto a mano in 60 punti. `size="xs"` per le note piccole.
 */
export function ErrorText({
  children,
  size = "sm",
  className,
}: {
  children: React.ReactNode;
  size?: "sm" | "xs";
  className?: string;
}) {
  return (
    <p role="alert" className={cn(size === "xs" ? "text-xs" : "text-sm", "text-red-600 dark:text-red-400", className)}>
      {children}
    </p>
  );
}
