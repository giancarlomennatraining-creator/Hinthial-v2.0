import Link from "next/link";
import { starterHref } from "@/domain/capsules/starter";
import { dossierOverview } from "@/domain/dossiers/overview";
import { relativeDay } from "@/domain/documents/archive-views";
import { formatDate } from "@/lib/format";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import { ContextBackLink } from "@/components/ui/BackLink";
import type { DossierListItem } from "@/domain/dossiers/types";

/** In testa alla scheda: titolo, stato, quando e quanti documenti, la descrizione, e le azioni (Condividi, Fallo arrivare a…, Modifica, il menu). */
export function DossierHeader({
  dossier,
  overview,
  now,
  busy,
  onToggleStatus,
  onDelete,
}: {
  dossier: DossierListItem;
  overview: ReturnType<typeof dossierOverview>;
  now: Date;
  busy: boolean;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const dossierId = dossier.id;
  const isClosed = dossier.status === "closed";

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <ContextBackLink parent={{ href: "/dossiers", label: "Torna ai fascicoli" }} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-brand/10 dark:bg-brand/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            </svg>
          </span>
          <h1 className="min-w-0 text-[30px] leading-tight font-extrabold tracking-[-0.02em] break-words text-title">{dossier.title}</h1>
          <span
            className={`rounded-full px-[11px] py-1 text-[12.5px] font-bold ${
              isClosed ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300" : "bg-brand/10 text-accent dark:bg-brand/20 dark:text-accent"
            }`}
          >
            {isClosed ? "Chiuso" : "Aperto"}
          </span>
        </div>
        <p className="text-[13.5px] text-zinc-500 dark:text-zinc-400">
          {isClosed ? `Chiuso il ${formatDate(dossier.closedAt!)}` : "Aperto"} · creato il {formatDate(dossier.createdAt)} ·{" "}
          {overview.documentCount} {overview.documentCount === 1 ? "documento" : "documenti"}
          {overview.lastUpdate ? ` · ultimo ${relativeDay(overview.lastUpdate, now)}` : ""}
        </p>
        {dossier.description ? (
          <p className="max-w-3xl text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{dossier.description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Link
          href={`/dossiers/${dossierId}/share`}
          className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-accent hover:border-brand dark:border-zinc-700 dark:bg-zinc-950"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
            <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
          </svg>
          Condividi
        </Link>
        <Link
          href={starterHref("fascicolo", dossierId)}
          className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-accent hover:border-brand dark:border-zinc-700 dark:bg-zinc-950"
        >
          Fallo arrivare a…
        </Link>
        <Link
          href={`/dossiers/${dossierId}/edit`}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          Modifica
        </Link>
        {/* Le azioni che si fanno di rado, e quella che non si disfa, stanno in un menu: in testa restano tre pulsanti. */}
        <RowActionsMenu label="Altre azioni">
          <RowMenuItem disabled={busy} onClick={onToggleStatus}>
            {isClosed ? "Riapri fascicolo" : "Chiudi fascicolo"}
          </RowMenuItem>
          <RowMenuItem disabled={busy} danger onClick={onDelete}>
            Elimina
          </RowMenuItem>
        </RowActionsMenu>
      </div>
    </div>
  );
}
