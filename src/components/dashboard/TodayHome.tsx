"use client";

import Link from "next/link";
import { useState } from "react";
import { ContinuitySign } from "@/components/dashboard/ContinuitySign";
import { useTodayExtras } from "@/components/dashboard/useTodayExtras";
import { Skeleton } from "@/components/ui/Skeleton";
import { isOpeningSoon, sortByOpening } from "@/domain/capsules/overview";
import { continuityScore, continuitySteps } from "@/domain/continuity/steps";
import { dueIn, expiryInfo, needsAttention } from "@/domain/documents/archive-views";
import type { SummaryContext } from "@/domain/ai/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const CARD =
  "min-w-0 surface-card rounded-card border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950";

/** Quante righe al massimo per ogni elenco: "Oggi" è un colpo d'occhio, non una pagina da scorrere. */
const MAX_ROWS = 4;

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(iso)}, ${time}`;
}

/**
 * "Oggi": la home di Hinthial. Tre cose in ordine di importanza per chi ama: quanto Hinthial è pronto a far arrivare ciò
 * che sai e ciò che hai a chi resta (la continuità), cosa sta per arrivare a chi ami (le capsule), e cosa scade presto.
 * Tutto si ricava dai dati già decifrati in pagina più poche letture in più (v. useTodayExtras).
 */
export function TodayHome({ context, masterKey }: { context: SummaryContext; masterKey: CryptoKey }) {
  const extras = useTodayExtras(masterKey);
  // Letto una volta al mount, non chiamando l'impuro Date.now() durante il render.
  const [now] = useState(() => new Date());

  const steps = extras
    ? continuitySteps({
        guardianCount: context.friends.filter((f) => f.isGuardian && f.status === "active").length,
        legacyEnabled: extras.legacyEnabled,
        emergencyCardFilled: extras.emergencyCardFilled,
        capsulesForOthers: context.capsules.filter((c) => c.status !== "draft" && c.relatedFriends.length > 0).length,
        capsulesForDelivery: context.capsules.filter(
          (c) => c.status !== "draft" && c.relatedFriends.length > 0 && c.openOnLegacy,
        ).length,
      })
    : null;
  const score = steps ? continuityScore(steps) : null;

  // Le capsule: prima quelle che aspettano me, poi quelle che si aprono presto, poi le bozze da chiudere.
  const readyForMe = (extras?.sharedWithMe ?? []).filter(
    (s) => s.released || (s.openAt !== null && new Date(s.openAt) <= now),
  );
  const openingSoon = sortByOpening(
    context.capsules.filter((c) => isOpeningSoon(c, now)),
    now,
  );
  const drafts = context.capsules.filter((c) => c.status === "draft");
  const capsuleRows = readyForMe.length + openingSoon.length + drafts.length;

  // Le scadenze vicine sono le promemoria aperti e i documenti in scadenza o già scaduti (v. needsAttention), dalla più
  // urgente: quelle già passate prima.
  const deadlines = [
    ...context.reminders.filter((r) => !r.completed).map((r) => ({ key: `reminder-${r.id}`, title: r.title, date: r.dueAt })),
    ...context.documents
      .filter((d) => d.expiresAt && needsAttention(expiryInfo(d.expiresAt, now)))
      .map((d) => ({ key: `document-${d.id}`, title: d.filename, date: d.expiresAt as string })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_ROWS);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section aria-label="Continuità" className={cn(CARD, "flex items-center gap-6")}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-heading text-lg font-extrabold text-zinc-900 dark:text-zinc-100">Continuità</h2>
            {score ? (
              <p className="text-sm font-semibold text-accent">
                {score.done} su {score.total}
              </p>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Quanto Hinthial è pronto a far arrivare ciò che sai e ciò che hai alle persone a cui tieni, se un giorno non ci sei.
          </p>
          {steps && score ? (
            <>
              <div
                role="progressbar"
                aria-label="Continuità"
                aria-valuemin={0}
                aria-valuemax={score.total}
                aria-valuenow={score.done}
                className="sig-bar mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900"
              >
                <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(score.done / score.total) * 100}%` }} />
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {steps.map((step) => (
                  <li key={step.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          step.done
                            ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                            : "border border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700",
                        )}
                      >
                        {step.done ? "✓" : ""}
                      </span>
                      <span className={cn("min-w-0", step.done ? "text-zinc-600 dark:text-zinc-400" : "font-medium text-zinc-900 dark:text-zinc-100")}>
                        {step.label}
                      </span>
                    </span>
                    {step.done ? null : (
                      <Link href={step.href} className="shrink-0 text-xs font-semibold text-accent hover:underline">
                        {step.action} →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div role="status" aria-label="Caricamento…" className="mt-3 flex flex-col gap-2">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
        </div>
        {steps ? <ContinuitySign done={steps.map((step) => step.done)} /> : null}
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section aria-label="Per chi ami" className={CARD}>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Per chi ami</h2>
          {capsuleRows === 0 ? (
            <div className="mt-2 flex flex-col items-start gap-2">
              <p className="hand-note text-xs text-zinc-500 dark:text-zinc-400">
                Una capsula arriva a qualcuno al momento giusto: una lettera, un ricordo, un messaggio per una data che conta.
              </p>
              <Link href="/capsules/new" className="text-xs font-semibold text-accent hover:underline">
                Scrivi una capsula →
              </Link>
            </div>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {readyForMe.slice(0, MAX_ROWS).map((s) => (
                <li key={`shared-${s.id}`} className="min-w-0 text-xs">
                  <Link href="/capsules?tab=shared" className="block hover:underline">
                    <p className="truncate font-medium text-green-700 dark:text-green-400">Da {s.ownerName}: pronta da aprire</p>
                    <p className="text-zinc-500 dark:text-zinc-400">Ti aspetta dal {s.openAt ? formatDate(s.openAt) : "—"}</p>
                  </Link>
                </li>
              ))}
              {openingSoon.slice(0, MAX_ROWS).map((c) => (
                <li key={`soon-${c.id}`} className="min-w-0 text-xs">
                  <Link href="/capsules" className="block hover:underline">
                    <p className="truncate font-medium text-zinc-800 dark:text-zinc-200">{c.title}</p>
                    <p className="text-zinc-500 dark:text-zinc-400">Si apre il {c.openAt ? formatDateTime(c.openAt) : "—"}</p>
                  </Link>
                </li>
              ))}
              {drafts.slice(0, MAX_ROWS).map((c) => (
                <li key={`draft-${c.id}`} className="min-w-0 text-xs">
                  <Link href="/capsules" className="block hover:underline">
                    <p className="truncate font-medium text-zinc-800 dark:text-zinc-200">{c.title}</p>
                    <p className="text-zinc-500 dark:text-zinc-400">Bozza: da chiudere</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/capsules" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
            Vai alle capsule
          </Link>
        </section>

        <section aria-label="Scadenze vicine" className={CARD}>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Scadenze vicine</h2>
          {deadlines.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Nessuna scadenza da ricordare.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {deadlines.map((d) => {
                const late = new Date(d.date) < now;
                const due = dueIn(d.date, now);
                return (
                  <li key={d.key} className="min-w-0 text-xs">
                    <p className={cn("truncate font-medium", late ? "text-red-700 dark:text-red-400" : "text-zinc-800 dark:text-zinc-200")}>
                      {d.title}
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400">
                      {late ? "scaduta il " : ""}
                      {formatDate(d.date)}
                      <span className={cn("font-medium", due.level === "overdue" ? "text-red-700 dark:text-red-400" : due.level === "danger" ? "text-orange-700 dark:text-orange-400" : due.level === "warn" ? "text-amber-700 dark:text-amber-400" : "")}> · {due.text}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/reminders" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
            Vai alle scadenze
          </Link>
        </section>
      </div>
    </div>
  );
}
