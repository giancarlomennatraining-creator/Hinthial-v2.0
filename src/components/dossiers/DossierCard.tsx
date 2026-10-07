"use client";

import Link from "next/link";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import { mixColor, relativeDay } from "@/domain/documents/archive-views";
import { formatEuro, type DossierOverview } from "@/domain/dossiers/overview";
import type { DossierListItem } from "@/domain/dossiers/types";
import { formatDate } from "@/lib/format";
import { phaseState } from "@/domain/dossiers/phases";

/**
 * Una scheda dell'elenco dei fascicoli: lo stato, la prossima scadenza, quanti documenti, quanto si è speso. Tutto si
 * ricava dai documenti del fascicolo (v. domain/dossiers/overview.ts): nessuno deve compilare niente.
 */
export function DossierCard({
  dossier,
  overview,
  color,
  pageColors,
  now,
  busy,
  onOpen,
  onEdit,
  onDelete,
}: {
  dossier: DossierListItem;
  overview: DossierOverview;
  /** Il colore della categoria più presente nei documenti del fascicolo. */
  color: string;
  /** I colori delle categorie degli ultimi documenti, per le tre paginette. */
  pageColors: string[];
  now: Date;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const closed = dossier.status === "closed";
  const next = overview.nextDeadline;
  const urgent = next !== null && (next.info.level === "overdue" || next.info.level === "danger");
  const countLabel = `${overview.documentCount} ${overview.documentCount === 1 ? "documento" : "documenti"}`;
  const stats = [countLabel, overview.expenses ? formatEuro(overview.expenses.total) : null, overview.assets.length > 0 ? `${overview.assets.length} ${overview.assets.length === 1 ? "bene" : "beni"}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`group relative flex flex-col gap-3.5 rounded-[18px] border border-[#dfe3f0] bg-white p-4 pb-3.5 shadow-[0_2px_8px_rgba(18,26,53,0.05)] transition-all duration-[180ms] hover:-translate-y-[3px] hover:shadow-[0_16px_32px_rgba(18,26,53,0.12)] dark:border-zinc-800 dark:bg-zinc-950 ${
        closed ? "opacity-90" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: mixColor(color, "#ffffff", 0.88) }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          </svg>
        </span>
        <div className="relative z-10 flex items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-[3px] text-xs font-bold ${
              closed ? "bg-[#eceff4] text-[#5b6483] dark:bg-zinc-800 dark:text-zinc-300" : "bg-[#e8edfc] text-brand dark:bg-brand/20 dark:text-[#9db6ff]"
            }`}
          >
            {closed ? "Chiuso" : "Aperto"}
          </span>
          <RowActionsMenu label={`Azioni per ${dossier.title}`}>
            <RowMenuItem disabled={busy} onClick={onOpen}>
              Apri
            </RowMenuItem>
            <RowMenuItem disabled={busy} onClick={onEdit}>
              Modifica
            </RowMenuItem>
            <RowMenuItem disabled={busy} danger onClick={onDelete}>
              Elimina
            </RowMenuItem>
          </RowActionsMenu>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {/* Il titolo è un vero link, e il suo ::after copre tutta la scheda: si apre da ovunque, tranne dal menu. */}
        <Link
          href={`/dossiers/${dossier.id}`}
          className="font-heading text-lg leading-tight font-extrabold tracking-[-0.01em] text-[#121a35] after:absolute after:inset-0 after:content-[''] hover:text-brand dark:text-zinc-100"
        >
          {dossier.title}
        </Link>
        <p className="line-clamp-2 text-[13px] text-[#5b6483] dark:text-zinc-400">
          {dossier.description ||
            (closed && dossier.closedAt ? `Chiuso il ${formatDate(dossier.closedAt)}` : `Creato il ${formatDate(dossier.createdAt)}`)}
        </p>
      </div>

      {dossier.phases ? (
        <div className="flex flex-col gap-1.5" aria-label={`Fase: ${dossier.phases.names[dossier.phases.current]}`}>
          <div className="flex gap-1" aria-hidden="true">
            {dossier.phases.names.map((name, i) => (
              <span
                key={`${i}-${name}`}
                className="h-1 flex-1 rounded-full"
                style={{ background: phaseState(dossier.phases!, i) === "todo" ? "#e3e7f3" : phaseState(dossier.phases!, i) === "done" ? "#1c7c5a" : color }}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-[#3d4670] dark:text-zinc-300">
            Fase {dossier.phases.current + 1} di {dossier.phases.names.length} · {dossier.phases.names[dossier.phases.current]}
          </span>
        </div>
      ) : null}

      {next && !closed ? (
        <div
          className="flex items-center gap-2 rounded-[10px] px-[11px] py-2"
          style={{ background: urgent ? "#fde9e7" : next.info.level === "warn" ? "#fdf3dd" : "#eef0f8" }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke={urgent ? "#b42318" : next.info.level === "warn" ? "#8a5a00" : "#4a5275"}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span className="min-w-0 truncate text-[12.5px] font-bold" style={{ color: urgent ? "#b42318" : next.info.level === "warn" ? "#8a5a00" : "#4a5275" }}>
            {next.kind === "document" ? `${next.title.replace(" scade", "")} · ${next.info.text}` : `${next.title} · ${next.info.text.replace("scade ", "")}`}
          </span>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2.5 border-t border-[#eef0f8] pt-3 dark:border-zinc-900">
        <div className="flex min-w-0 flex-col gap-px">
          <span className="text-[12.5px] font-semibold text-[#3d4670] dark:text-zinc-300">{stats}</span>
          <span className="text-[11.5px] text-[#8a91ad] dark:text-zinc-500">
            {overview.lastUpdate ? `ultimo documento ${relativeDay(overview.lastUpdate, now)}` : "ancora nessun documento"}
          </span>
        </div>
        <div className="flex items-center" aria-hidden="true">
          {pageColors.slice(0, 3).map((c, i) => (
            <span
              key={i}
              className="-ml-2 block h-[34px] w-[26px] overflow-hidden rounded-[3px] bg-white shadow-[0_1px_4px_rgba(18,26,53,0.25)]"
            >
              <span className="block h-[7px]" style={{ background: c }} />
              <span className="mx-1 mt-[5px] block h-0.5 bg-[#dfe3f0]" />
              <span className="mx-1 mt-[3px] block h-0.5 w-3/5 bg-[#dfe3f0]" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
