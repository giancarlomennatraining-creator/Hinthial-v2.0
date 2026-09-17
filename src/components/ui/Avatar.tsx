const COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-600",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-600",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-pink-500",
];

/** Deterministic (same seed --- e.g. the user id --- always gives the same color), just to tell people apart at a glance. */
function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

function initialsOf(firstName: string, lastName: string): string {
  const initials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
  return initials || "?";
}

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[0.6rem]",
  md: "h-9 w-9 text-sm",
  lg: "h-20 w-20 text-2xl",
} as const;

/** Il tondino "H" nell'angolo, in scala con l'avatar --- v. prop `linked` sotto. */
const BADGE_SIZE_CLASSES = {
  sm: "h-2.5 w-2.5 text-[0.35rem]",
  md: "h-3.5 w-3.5 text-[0.5rem]",
  lg: "h-6 w-6 text-[0.65rem]",
} as const;

/**
 * Cerchio con la foto profilo, o le iniziali su sfondo colorato quando
 * non ne è stata caricata una --- v. Impostazioni -> Informazioni utente.
 */
export function Avatar({
  firstName,
  lastName,
  avatarUrl,
  seed,
  size = "md",
  linked = false,
}: {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  /** Qualcosa di stabile per questo utente (es. il suo id) --- decide solo il colore delle iniziali. */
  seed: string;
  size?: keyof typeof SIZE_CLASSES;
  /**
   * Piccolo badge "H" blu nell'angolo in basso a destra --- questa
   * persona ha un account Hinthial collegato (v. Amici). Sostituisce
   * l'etichetta testuale "✓ Su Hinthial" che, insieme agli altri badge
   * della riga (stato, Guardiano...), finiva per sforare lo schermo su
   * smartphone (v. richiesta utente).
   */
  linked?: boolean;
}) {
  const sizeClass = SIZE_CLASSES[size];

  const inner = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a static local asset
    <img src={avatarUrl} alt="" className={`${sizeClass} rounded-full object-cover`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${sizeClass} flex items-center justify-center rounded-full font-semibold text-white ${colorFor(seed)}`}
    >
      {initialsOf(firstName, lastName)}
    </span>
  );

  return (
    <span className="relative inline-flex shrink-0">
      {inner}
      {linked ? (
        <span
          role="img"
          aria-label="Ha un account Hinthial"
          title="Ha un account Hinthial"
          className={`absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full bg-brand font-bold text-white ring-2 ring-white dark:ring-zinc-950 ${BADGE_SIZE_CLASSES[size]}`}
        >
          H
        </span>
      ) : null}
    </span>
  );
}
