"use client";

import { useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { listFriends } from "@/domain/friends/repository";
import { listCapsules } from "@/domain/capsules/repository";
import {
  buildDigitalLegacyRehearsal,
  groupSharedCapsulesByRecipient,
  type RehearsalEvent,
  type RecipientGroup,
} from "@/domain/digital-legacy/rehearsal";
import { GUARDIAN_QUORUM_LABEL, describeDigitalLegacySettings, type DigitalLegacySettings } from "@/domain/digital-legacy/types";
import { formatDate } from "@/lib/format";
import type { FriendListItem } from "@/domain/friends/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Le prime parole del contenuto, non la lettera intera --- questa non è CapsulePreview, solo un indizio di cosa c'è. */
function snippet(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "Nessun testo scritto.";
  return trimmed.length > 90 ? `${trimmed.slice(0, 90)}…` : trimmed;
}

function EventRow({ event, isLast }: { event: RehearsalEvent; isLast: boolean }) {
  const dateLabel = event.rangeEndDate
    ? `${formatDate(event.date.toISOString())} → ${formatDate(event.rangeEndDate.toISOString())}`
    : formatDate(event.date.toISOString());

  return (
    <div className="grid grid-cols-[6.5rem_1.375rem_1fr] gap-3">
      <span className="pt-0.5 text-right text-xs font-semibold text-zinc-900 dark:text-zinc-100">
        {dateLabel}
      </span>
      <span className="flex flex-col items-center">
        <span
          className={
            event.isExample
              ? "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-brand bg-white text-xs dark:bg-zinc-950"
              : "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brand text-xs"
          }
        >
          {event.icon}
        </span>
        {isLast ? null : <span className="mt-0.5 min-h-[1.375rem] w-0.5 flex-1 bg-zinc-200 dark:bg-zinc-800" />}
      </span>
      <div className={isLast ? "flex flex-col gap-0.5" : "flex flex-col gap-0.5 pb-5"}>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {event.title}
          {event.isExample ? (
            <span className="ml-1.5 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
              Esempio
            </span>
          ) : null}
        </span>
        <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{event.detail}</span>
      </div>
    </div>
  );
}

function GuardianRow({ guardian }: { guardian: FriendListItem }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
        {initials(guardian.name)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{guardian.name}</span>
        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{guardian.role || "Guardiano/a"}</span>
      </span>
    </div>
  );
}

function RecipientBlock({ group }: { group: RecipientGroup }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        👤 {group.recipient.name} --- {group.capsules.length}{" "}
        {group.capsules.length === 1 ? "capsula" : "capsule"}
      </span>
      {group.capsules.map((capsule) => (
        <div key={capsule.id} className="rounded-lg border border-[#EDE1C4] bg-[#FBF6EA] px-3 py-2">
          <p className="text-xs font-bold text-[#6B5730]">&laquo;{capsule.title}&raquo;</p>
          <p className="mt-0.5 text-xs text-[#3B331F]">{snippet(capsule.content)}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * "Prova generale": estende l'anteprima già esistente per una singola
 * capsula (v. CapsulePreview.tsx, "Così la vedrà chi la riceve") a uno
 * scenario intero --- se "Eredità digitale" si attivasse oggi, quando
 * succederebbe cosa, chi verrebbe interpellato e chi riceverebbe cosa.
 * Nessun accesso reale concesso, nessuna email davvero inviata: pura
 * lettura di dati già esistenti (v. domain/digital-legacy/rehearsal.ts).
 *
 * Richiede la master key (guardiani/capsule sono cifrati) --- a
 * differenza del resto della scheda Eredità digitale, che non la
 * richiede (v. SettingsTabs.tsx): per questo vive in un componente a
 * parte, dietro il proprio RequireMasterKey, invece di forzare uno
 * sblocco solo per vedere i parametri numerici della strategia.
 */
export function DigitalLegacyRehearsal({
  masterKey,
  settings,
}: {
  masterKey: CryptoKey;
  settings: DigitalLegacySettings;
}) {
  const [supabase] = useState(() => createClient());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardians, setGuardians] = useState<FriendListItem[]>([]);
  const [recipientGroups, setRecipientGroups] = useState<RecipientGroup[]>([]);

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const [friends, capsules] = await Promise.all([
        listFriends(supabase, masterKey),
        listCapsules(supabase, masterKey),
      ]);
      setGuardians(friends.filter((f) => f.isGuardian && f.linkedUserId !== null));
      setRecipientGroups(groupSharedCapsulesByRecipient(capsules));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile preparare la prova generale.");
    } finally {
      setLoading(false);
    }
  }

  const events = buildDigitalLegacyRehearsal(settings, new Date(), guardians.map((g) => g.name));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">La prova generale</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Se si attivasse oggi: quando succederebbe cosa, chi verrebbe interpellato, e chi
          riceverebbe cosa --- con i tuoi guardiani e le tue capsule già condivise veri, non un
          esempio. Nessun accesso reale viene concesso e nessuna email viene davvero inviata.
        </p>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        className="w-fit rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        🎬 Prova generale
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[6vh]"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Prova generale di Eredità digitale"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-3xl flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-brand">Se si attivasse oggi</h3>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  Una simulazione del percorso completo, con lo stato attuale del tuo account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Chiudi la prova generale"
                className="shrink-0 rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                ✕
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Preparazione…</p>
            ) : error ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : (
              <>
                <p className="rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  Con le tue impostazioni attuali: {describeDigitalLegacySettings(settings)}
                </p>

                <div className="max-h-[45vh] overflow-y-auto pr-1">
                  {events.map((event, i) => (
                    <EventRow key={event.id} event={event} isLast={i === events.length - 1} />
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      🛡️ I tuoi guardiani
                    </span>
                    {guardians.length === 0 ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Non hai ancora nessun guardiano collegato --- puoi aggiungerne uno da Amici.
                      </p>
                    ) : (
                      <>
                        {guardians.map((guardian) => (
                          <GuardianRow key={guardian.id} guardian={guardian} />
                        ))}
                        <p className="rounded-lg bg-brand/5 px-3 py-2 text-xs font-medium text-brand">
                          {GUARDIAN_QUORUM_LABEL[settings.guardianQuorum]}.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      💌 Chi riceverebbe cosa
                    </span>
                    {recipientGroups.length === 0 ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Nessuna capsula già condivisa oggi --- solo quelle &quot;condivise&quot; si
                        aprirebbero, mai le bozze.
                      </p>
                    ) : (
                      recipientGroups.map((group) => (
                        <RecipientBlock key={group.recipient.id} group={group} />
                      ))
                    )}
                  </div>
                </div>

                <p className="border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  🔒 Solo un&apos;anteprima su questo schermo --- nessun accesso reale viene
                  concesso a nessuno a questo punto, e nessun promemoria è stato davvero inviato.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
