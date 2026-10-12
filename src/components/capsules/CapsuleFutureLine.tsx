"use client";

import type { FutureLine } from "@/domain/capsules/overview";
import type { CapsuleStatus } from "@/domain/capsules/types";
import { formatDate } from "@/lib/format";

const MARKER_COLOR: Record<CapsuleStatus, string> = {
  draft: "#8a91ad",
  ready: "#2b4fc4",
  shared: "#1c7c5a",
};

/**
 * La linea del futuro: da oggi all'ultima apertura prevista, con ogni capsula non ancora aperta come una tappa.
 * Le posizioni vengono da domain/capsules/overview.ts (`buildFutureLine`); qui si disegna soltanto. Sotto uno schermo
 * stretto scorre di lato dentro il suo riquadro, senza allargare la pagina.
 */
export function CapsuleFutureLine({ line }: { line: FutureLine }) {
  return (
    <section
      aria-label="Quando si apriranno"
      className="overflow-x-auto rounded-2xl border border-[#dfe3f0] bg-white shadow-[0_2px_8px_rgba(18,26,53,0.05)] dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="relative min-w-[560px] px-16 pb-16 pt-14">
        <div className="relative h-[3px] rounded-full bg-[#dfe3f0] dark:bg-zinc-800">
          <Stop percent={0} label="Oggi" side="below" color="#121a35" />
          {line.ticks.map((tick) => (
            <span
              key={tick.year}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${tick.percent}%` }}
              aria-hidden="true"
            >
              <span className="-mt-[5px] h-[13px] w-px bg-[#c9d0e6] dark:bg-zinc-700" />
              <span className="mt-[46px] text-[11px] font-semibold text-[#8a91ad] dark:text-zinc-500">{tick.year}</span>
            </span>
          ))}
          {line.markers.map((marker) => (
            <Stop
              key={marker.id}
              percent={marker.percent}
              label={marker.title}
              detail={formatDate(marker.openAt)}
              side={marker.side}
              color={MARKER_COLOR[marker.status]}
            />
          ))}
        </div>
        {line.hidden > 0 ? (
          <p className="mt-6 text-xs text-[#5b6483] dark:text-zinc-400">
            E altre {line.hidden} {line.hidden === 1 ? "apertura" : "aperture"} più in là.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Stop({
  percent,
  label,
  detail,
  side,
  color,
}: {
  percent: number;
  label: string;
  detail?: string;
  side: "above" | "below";
  color: string;
}) {
  return (
    <div className="absolute top-1/2" style={{ left: `${percent}%` }}>
      <span
        className="absolute left-0 top-0 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white dark:border-zinc-950"
        style={{ background: color, boxShadow: `0 0 0 1px ${color}` }}
        aria-hidden="true"
      />
      <span
        className={`absolute left-0 flex w-32 -translate-x-1/2 flex-col items-center text-center leading-tight ${
          side === "above" ? "bottom-3" : "top-3"
        }`}
      >
        <span className="max-w-full truncate text-xs font-bold text-[#121a35] dark:text-zinc-100">{label}</span>
        {detail ? <span className="text-[11px] text-[#5b6483] dark:text-zinc-400">{detail}</span> : null}
      </span>
    </div>
  );
}
