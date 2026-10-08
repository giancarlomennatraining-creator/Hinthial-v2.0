"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { useState, type ReactNode } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  AIIcon,
  AlertTriangleIcon,
  ArchiveIcon,
  AssetIcon,
  CapsuleIcon,
  CheckCircleIcon,
  FriendIcon,
  ReminderIcon,
  SecurityIcon,
} from "@/components/icons/nav-icons";
import { Avatar } from "@/components/ui/Avatar";
import { useIncomingFriendRequests, usePendingProposals } from "@/components/dashboard/useDashboardNotices";
import { useToast } from "@/components/ui/ToastProvider";
import type { SummaryContext } from "@/domain/ai/types";
import { buildBento, type BentoAssetRow } from "@/domain/dashboard/bento";
import { agoText, whenText } from "@/domain/dashboard/deadlines";
import { categoryColor, UNCATEGORIZED_COLOR } from "@/domain/documents/archive-views";
import { cn } from "@/lib/utils";

const TILE =
  "group relative flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-[22px] border border-zinc-200 bg-white p-4 transition duration-200 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_10px_30px_rgba(18,26,53,0.1)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700";

function Label({ icon: Icon, children, className }: { icon: ComponentType<SVGProps<SVGSVGElement>>; children: ReactNode; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5 text-xs font-bold tracking-wide text-zinc-500 dark:text-zinc-400", className)}>
      <Icon width={15} height={15} className="text-brand" />
      {children}
    </span>
  );
}

/** Un anello di avanzamento: `pct` da 0 a 1, col testo al centro. */
function Ring({ pct, label, color = "var(--brand)" }: { pct: number; label: string; color?: string }) {
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-zinc-200 dark:stroke-zinc-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <b className="absolute inset-0 grid place-items-center text-lg font-extrabold text-zinc-900 dark:text-zinc-100">{label}</b>
    </span>
  );
}

const ASSET_PILL: Record<BentoAssetRow["status"], { text: string; cls: string }> = {
  over: { text: "scaduta", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
  soon: { text: "in arrivo", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" },
  ok: { text: "ok", cls: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" },
};

function nameParts(full: string, first: string, last: string): [string, string] {
  if (first || last) return [first, last];
  const [f = "", ...rest] = full.trim().split(/\s+/);
  return [f, rest.join(" ")];
}

/**
 * La dashboard "Bento": un colpo d'occhio su tutto, in riquadri di misure diverse, ognuno col suo gesto (il conto alla
 * rovescia, il ventaglio dei documenti, l'anello della capsula, una domanda per Hinthia). Tutto ricavato dallo stesso
 * contesto delle altre (v. buildBento); ogni riquadro porta alla sua sezione.
 */
export function DashboardBento({
  supabase,
  masterKey,
  context,
  now,
}: {
  supabase: SupabaseClient<Database>;
  masterKey: CryptoKey;
  context: SummaryContext;
  now: Date;
}) {
  const router = useRouter();
  const showToast = useToast();
  const data = buildBento(context, now);
  const friendRequests = useIncomingFriendRequests(supabase, masterKey);
  const pendingProposals = usePendingProposals(supabase, masterKey, context, now);
  const [question, setQuestion] = useState("");

  function ask(text: string) {
    const trimmed = text.trim();
    router.push(trimmed ? `/ai?q=${encodeURIComponent(trimmed)}` : "/ai");
  }

  const colorOf = (categoryId: string | null) => {
    const category = context.categories.find((c) => c.id === categoryId);
    return category ? categoryColor(category.name) : UNCATEGORIZED_COLOR;
  };

  const chips = [
    data.next ? `Quando scade ${data.next.reminder.title}?` : "Cosa devo ancora fare?",
    data.overdueCount > 0 ? "Cosa è già scaduto?" : "Cosa scade questo mese?",
  ];

  const capsule = data.nextCapsule;
  const missing = data.steps.missing;

  return (
    <div className="@container min-w-0">
      <div className="grid min-w-0 grid-flow-dense grid-cols-2 gap-3 @3xl:grid-cols-4 @3xl:gap-3.5">
        {/* Prossima scadenza */}
        <Link
          href="/reminders"
          className={cn(
            TILE,
            "col-span-2 min-h-[210px] justify-between border-0 bg-gradient-to-br from-brand to-[#16307f] text-white hover:border-0 @3xl:row-span-2",
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-16 size-64 rounded-full border-2 border-white/15 shadow-[0_0_0_28px_rgba(255,255,255,0.05),0_0_0_56px_rgba(255,255,255,0.04)]"
          />
          <Label icon={ReminderIcon} className="relative text-white/80 [&_svg]:text-teal-200">
            Prossima scadenza
          </Label>
          <div className="relative">
            {data.next ? (
              <>
                <h2 className="text-[clamp(1.5rem,6cqw,2rem)] font-extrabold leading-[1.08] tracking-tight">
                  {data.next.reminder.title}{" "}
                  <em className="not-italic text-teal-200">{whenText(data.next.days)}</em>
                </h2>
                <p className="mt-1.5 text-sm text-white/80">
                  {new Date(data.next.reminder.dueAt).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
                  {data.next.reminder.relatedAssetName ? ` · ${data.next.reminder.relatedAssetName}` : ""}
                </p>
              </>
            ) : (
              <h2 className="text-[clamp(1.5rem,6cqw,2rem)] font-extrabold leading-[1.08] tracking-tight">
                Nessuna scadenza <em className="not-italic text-teal-200">in arrivo</em>
              </h2>
            )}
          </div>
          <div className="relative flex flex-wrap gap-1.5">
            {data.overdueCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">
                <AlertTriangleIcon width={12} height={12} />
                {data.overdueCount === 1 ? "1 scaduta" : `${data.overdueCount} scadute`}
              </span>
            ) : null}
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">
              {data.soonCount === 1 ? "1 nei prossimi 30 giorni" : `${data.soonCount} nei prossimi 30 giorni`}
            </span>
          </div>
        </Link>

        {/* Archivio */}
        <Link href="/archive" className={TILE}>
          <Label icon={ArchiveIcon}>Archivio</Label>
          <span className="text-[clamp(1.75rem,7cqw,2.4rem)] font-extrabold leading-none tracking-tight text-zinc-900 dark:text-zinc-100">
            {data.documentCount}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            documenti
            {data.newThisWeek > 0 ? ` · ${data.newThisWeek} ${data.newThisWeek === 1 ? "nuovo" : "nuovi"} questa settimana` : ""}
          </span>
          <span aria-hidden="true" className="relative mt-auto block h-[70px]">
            {data.recentDocuments.map((doc, i) => (
              <i
                key={doc.id}
                className={cn(
                  "absolute bottom-0 left-1/2 -ml-[25px] block h-16 w-[50px] origin-[50%_120%] overflow-hidden rounded-[7px] border-[1.5px] border-zinc-300 bg-white shadow-[0_4px_10px_rgba(18,26,53,0.12)] transition-transform duration-300 dark:border-zinc-700 dark:bg-zinc-900",
                  i === 0 && "-translate-x-3.5 -rotate-[16deg] group-hover:-translate-x-[22px] group-hover:-rotate-[24deg]",
                  i === 2 && "translate-x-3.5 rotate-[16deg] group-hover:translate-x-[22px] group-hover:rotate-[24deg]",
                )}
              >
                <span className="block h-3" style={{ background: colorOf(doc.categoryId) }} />
              </i>
            ))}
          </span>
        </Link>

        {/* Prossima capsula */}
        <Link href="/capsules" className={TILE}>
          <Label icon={CapsuleIcon}>Prossima capsula</Label>
          {capsule ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Ring pct={1 - Math.min(capsule.days, 90) / 90} label={String(capsule.days)} />
              <span className="min-w-0 text-xs text-zinc-500 dark:text-zinc-400">
                {capsule.days === 1 ? "giorno" : "giorni"} all&apos;apertura
                {capsule.recipient ? (
                  <>
                    {" "}
                    per <b className="text-zinc-900 dark:text-zinc-100">{capsule.recipient}</b>
                  </>
                ) : null}
              </span>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Nessuna capsula in programma.</p>
          )}
        </Link>

        {/* Amici */}
        <Link href="/friends" className={TILE}>
          <Label icon={FriendIcon}>Amici</Label>
          {context.friends.length > 0 ? (
            <span className="flex">
              {context.friends.slice(0, 4).map((friend, i) => {
                const [first, last] = nameParts(friend.name, friend.firstName, friend.lastName);
                return (
                  <span key={friend.id} className={cn(i > 0 && "-ml-2.5", "rounded-full ring-2 ring-white dark:ring-zinc-950")}>
                    <Avatar firstName={first} lastName={last} avatarUrl={friend.avatarUrl} seed={friend.id} />
                  </span>
                );
              })}
            </span>
          ) : null}
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {context.friends.length === 0
              ? "Ancora nessuno in rubrica."
              : `${data.friendCount} ${data.friendCount === 1 ? "amico" : "amici"} · ${data.guardianCount} ${data.guardianCount === 1 ? "guardiano" : "guardiani"}`}
          </span>
        </Link>

        {/* Richieste di amicizia: solo se ce ne sono; si accettano o rifiutano da qui */}
        {friendRequests.requests.length > 0 ? (
          <section className={cn(TILE, "col-span-2 hover:translate-y-0 hover:shadow-none")} aria-label="Richieste di amicizia">
            <Label icon={FriendIcon}>
              {friendRequests.requests.length === 1 ? "Richiesta di amicizia" : "Richieste di amicizia"}
            </Label>
            <ul className="flex flex-col gap-3">
              {friendRequests.requests.map((request) => (
                <li key={request.id} className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                    <b className="text-zinc-900 dark:text-zinc-100">{request.senderName}</b> vuole diventare tuo amico
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={friendRequests.busyId === request.id}
                      onClick={async () => {
                        const name = await friendRequests.accept(request);
                        showToast(name ? `Ora sei amico di ${name}.` : "Non è stato possibile accettare la richiesta: riprova da Amici.");
                      }}
                      className="rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                    >
                      Accetta
                    </button>
                    <button
                      type="button"
                      disabled={friendRequests.busyId === request.id}
                      onClick={() => void friendRequests.reject(request)}
                      className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Rifiuta
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Beni */}
        <Link href="/assets" className={cn(TILE, "col-span-2")}>
          <Label icon={AssetIcon}>Beni · {data.assetCount}</Label>
          {data.assetRows.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Ancora nessun bene censito.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.assetRows.map((row) => (
                <li key={row.id} className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-brand/10 text-brand">
                    <AssetIcon width={16} height={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{row.name}</b>
                    <small className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{row.detail}</small>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", ASSET_PILL[row.status].cls)}>
                    {ASSET_PILL[row.status].text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Link>

        {/* Chiedi a Hinthia */}
        <section className={cn(TILE, "col-span-2 hover:translate-y-0 hover:shadow-none")}>
          <Label icon={AIIcon}>Chiedi a Hinthia</Label>
          <form
            className="flex items-center gap-2 rounded-2xl border-[1.5px] border-zinc-300 bg-zinc-50 py-1.5 pl-3 pr-1.5 focus-within:border-brand focus-within:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:bg-zinc-950"
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              aria-label="Domanda per Hinthia"
              placeholder="Quando scade la mia polizza?"
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
            <button
              type="submit"
              aria-label="Chiedi"
              className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-brand text-white hover:bg-brand-hover"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 12l16-8-6 16-3-7Z" />
              </svg>
            </button>
          </form>
          {pendingProposals ? (
            <Link
              href={`/archive/${pendingProposals.first?.id ?? ""}`}
              className="flex items-center gap-2 rounded-xl bg-brand/10 px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/15"
            >
              <AIIcon width={14} height={14} />
              {pendingProposals.proposals === 1
                ? "Hinthia ha 1 proposta da rivedere"
                : `Hinthia ha ${pendingProposals.proposals} proposte da rivedere`}
            </Link>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => ask(chip)}
                className="max-w-full truncate rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/10 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {chip}
              </button>
            ))}
          </div>
        </section>

        {/* Primi passi */}
        <Link href={missing?.href ?? "/settings"} className={TILE}>
          <Label icon={SecurityIcon}>Primi passi</Label>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Ring
              pct={data.steps.done / data.steps.total}
              label={`${data.steps.done}/${data.steps.total}`}
              color="var(--color-teal-500, #14b8a6)"
            />
            <span className="min-w-0 text-xs text-zinc-500 dark:text-zinc-400">
              {missing ? (
                <>
                  manca: <b className="text-zinc-900 dark:text-zinc-100">{missing.label.toLowerCase()}</b>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-green-700 dark:text-green-400">
                  <CheckCircleIcon width={14} height={14} />
                  tutto pronto
                </span>
              )}
            </span>
          </div>
        </Link>

        {/* Appena aggiunti */}
        <Link href="/archive" className={TILE}>
          <Label icon={ArchiveIcon}>Appena aggiunti</Label>
          {data.recentDocuments.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Ancora nulla in archivio.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {data.recentDocuments.slice(0, 2).map((doc) => (
                <li key={doc.id} className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="relative h-[30px] w-6 shrink-0 overflow-hidden rounded-[5px] border-[1.5px] border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="block h-1.5" style={{ background: colorOf(doc.categoryId) }} />
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{doc.filename}</b>
                    <small className="text-xs text-zinc-500 dark:text-zinc-400">{agoText(doc.createdAt, now)}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Link>
      </div>
    </div>
  );
}
