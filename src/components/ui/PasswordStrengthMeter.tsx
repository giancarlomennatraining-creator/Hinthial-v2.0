import { evaluatePasswordStrength, PASSWORD_CRITERIA } from "@/lib/auth/password-strength";

const SEGMENT_COLOR_BY_SCORE = [
  "bg-red-500",
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-600",
];

/** Live strength score + checklist, shown as the user types a new password. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const { score, label, satisfied, isCommon } = evaluatePasswordStrength(password);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className="flex flex-1 gap-1"
          role="img"
          aria-label={`Robustezza password: ${label}`}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < score ? SEGMENT_COLOR_BY_SCORE[score] : "bg-zinc-200 dark:bg-zinc-800"
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      </div>

      <ul className="flex flex-col gap-1 text-xs">
        {PASSWORD_CRITERIA.map((criterion) => {
          const met = satisfied.includes(criterion.id);
          return (
            <li
              key={criterion.id}
              className={
                met
                  ? "text-green-700 dark:text-green-400"
                  : "text-zinc-500 dark:text-zinc-500"
              }
            >
              {met ? "✓" : "○"} {criterion.label}
            </li>
          );
        })}
      </ul>

      {isCommon ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          Questa è una password molto comune: scegline un&apos;altra.
        </p>
      ) : null}
    </div>
  );
}
