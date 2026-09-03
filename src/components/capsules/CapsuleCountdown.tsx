import { computeCountdown } from "@/lib/capsule-countdown";

/** Barra + etichetta verso la data di apertura di una capsula --- solo un promemoria visivo, nessuna apertura automatica (v. lib/capsule-countdown.ts). */
export function CapsuleCountdown({ createdAt, openAt }: { createdAt: string; openAt: string }) {
  const { progressPercent, label } = computeCountdown(createdAt, openAt);

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span
        role="progressbar"
        aria-label="Countdown verso l'apertura"
        aria-valuenow={Math.round(progressPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <span
          className="block h-full rounded-full bg-brand transition-[width]"
          style={{ width: `${progressPercent}%` }}
        />
      </span>
      <span>🕐 {label}</span>
    </div>
  );
}
