"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { FriendListItem, FriendStatus } from "@/domain/friends/types";
import type { CapsuleListItem } from "@/domain/capsules/types";

const STATUS_LABEL: Record<FriendStatus, string> = { active: "Attivo", revoked: "Revocato" };
const STATUS_BADGE_CLASS: Record<FriendStatus, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  revoked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  const time = new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(iso)}, ${time}`;
}

/** La lettera sotto cui sta una persona in rubrica: l'iniziale del nome, senza accenti; tutto ciò che non è una lettera va sotto "#". */
export function letterOf(name: string): string {
  const first = name.trim().charAt(0).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

/** Alfabetico per nome, come una rubrica. */
export function sortAlphabetically<T extends { name: string }>(people: T[]): T[] {
  return [...people].sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));
}

export function groupByLetter<T extends { name: string }>(people: T[]): { letter: string; people: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const person of sortAlphabetically(people)) {
    const letter = letterOf(person.name);
    groups.set(letter, [...(groups.get(letter) ?? []), person]);
  }
  // "#" in fondo, come nelle rubriche dei telefoni.
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
    .map(([letter, items]) => ({ letter, people: items }));
}

/** Nome e cognome per le iniziali: quelli salvati, altrimenti si ricavano dal nome visualizzato (gli amici più vecchi non li hanno). */
export function nameParts(friend: Pick<FriendListItem, "name" | "firstName" | "lastName">): { firstName: string; lastName: string } {
  if (friend.firstName.trim() || friend.lastName.trim()) return { firstName: friend.firstName, lastName: friend.lastName };
  const words = friend.name.trim().split(/\s+/).filter(Boolean);
  return { firstName: words[0] ?? "", lastName: words.length > 1 ? words[words.length - 1] : "" };
}

function matchesQuery(friend: FriendListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${friend.name} ${friend.role} ${friend.email}`.toLowerCase().includes(q);
}

/**
 * La rubrica: un indice a lettere, l'elenco a sinistra e la scheda della persona a destra. Su smartphone si vede una cosa
 * alla volta: la rubrica, e toccando una persona la sua scheda, con "← Rubrica" per tornare all'elenco (v. concept
 * "Rubrica", scelto dall'utente). Le azioni vere (amicizia, guardiano, revoca, elimina) restano quelle di prima:
 * le decide FriendsPanel, qui si mostrano soltanto.
 */
export function AddressBook({
  friends,
  capsulesFor,
  avatarUrlFor,
  isFriendRequestPending,
  isGuardianRequestPending,
  canRequestFriendship,
  busyId,
  onRequestFriendship,
  onToggleGuardian,
  renderMenu,
}: {
  friends: FriendListItem[];
  capsulesFor: (friend: FriendListItem) => CapsuleListItem[];
  avatarUrlFor: (friend: FriendListItem) => string | null;
  isFriendRequestPending: (friend: FriendListItem) => boolean;
  isGuardianRequestPending: (friend: FriendListItem) => boolean;
  canRequestFriendship: (friend: FriendListItem) => boolean;
  busyId: string | null;
  onRequestFriendship: (friend: FriendListItem) => void;
  onToggleGuardian: (friend: FriendListItem) => void;
  /** Il menu "⋮" con tutte le azioni, lo stesso della vista a tabella. */
  renderMenu: (friend: FriendListItem) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);

  const visible = useMemo(() => friends.filter((f) => matchesQuery(f, query)), [friends, query]);
  const groups = useMemo(() => groupByLetter(visible), [visible]);
  const ordered = useMemo(() => groups.flatMap((g) => g.people), [groups]);

  // La persona mostrata: quella scelta se c'è ancora, altrimenti la prima (su schermi larghi la scheda non resta mai vuota).
  const selected = ordered.find((f) => f.id === selectedId) ?? null;
  const shown = selected ?? ordered[0] ?? null;
  // Su smartphone la scheda si apre solo se si è toccata una persona che c'è ancora (eliminarla riporta alla rubrica).
  const detailOnMobile = mobileOpen && selected !== null;

  // Tornando alla rubrica, l'elenco riparte da dove lo si era lasciato.
  useLayoutEffect(() => {
    if (!detailOnMobile && listRef.current) listRef.current.scrollTop = savedScroll.current;
  }, [detailOnMobile]);

  // Su smartphone aprire una scheda aggiunge un passo alla cronologia del browser: il tasto "indietro" del telefono
  // torna alla rubrica invece di lasciare la pagina, e "avanti" riapre la scheda. Su schermo largo la scheda sta
  // accanto all'elenco e non tocca la cronologia.
  const pushedHistory = useRef(false);

  useEffect(() => {
    function onPopState() {
      const id = (window.history.state as { rubricaPerson?: string } | null)?.rubricaPerson;
      pushedHistory.current = Boolean(id);
      if (id) {
        setSelectedId(id);
        setMobileOpen(true);
      } else {
        setMobileOpen(false);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function open(friend: FriendListItem) {
    savedScroll.current = listRef.current?.scrollTop ?? 0;
    setSelectedId(friend.id);
    setMobileOpen(true);
    if (window.matchMedia("(max-width: 767px)").matches) {
      window.history.pushState({ rubricaPerson: friend.id }, "");
      pushedHistory.current = true;
    }
    window.scrollTo({ top: 0 });
  }

  /** "← Rubrica": come il tasto indietro del telefono, per non lasciare in cronologia un passo che non c'è più. */
  function backToList() {
    if (pushedHistory.current) {
      window.history.back();
    } else {
      setMobileOpen(false);
    }
  }

  function jumpTo(letter: string) {
    const container = listRef.current;
    const target = container?.querySelector<HTMLElement>(`[data-letter="${letter}"]`);
    if (container && target) container.scrollTo({ top: target.offsetTop - container.offsetTop, behavior: "smooth" });
  }

  const letters = new Set(groups.map((g) => g.letter));

  return (
    <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] md:gap-5">
      {/* La rubrica: su smartphone sparisce quando si guarda la scheda di una persona. */}
      <section aria-label="Rubrica" className={`${detailOnMobile ? "hidden md:flex" : "flex"} min-w-0 flex-col gap-3`}>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-500 focus-within:border-brand dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome, ruolo o email"
            aria-label="Cerca tra gli amici"
            className="min-w-0 flex-1 bg-transparent text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          />
        </label>

        <div className="flex gap-1.5">
          <div
            ref={listRef}
            className="max-h-[calc(100dvh-17rem)] min-h-[200px] min-w-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] md:max-h-[640px] dark:border-zinc-800 dark:bg-zinc-950"
          >
            {ordered.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">Nessuno corrisponde alla ricerca.</p>
            ) : (
              <ul>
                {groups.map((group) => (
                  <li key={group.letter} role="presentation">
                    <p
                      data-letter={group.letter}
                      className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50 px-4 py-1 text-xs font-extrabold tracking-widest text-brand dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      {group.letter}
                    </p>
                    <ul>
                      {group.people.map((friend) => {
                        const active = shown?.id === friend.id;
                        return (
                          <li key={friend.id} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
                            <button
                              type="button"
                              onClick={() => open(friend)}
                              aria-current={active ? "true" : undefined}
                              className={`relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                                active ? "bg-brand/10 md:before:absolute md:before:inset-y-2 md:before:left-0 md:before:w-1 md:before:rounded-r md:before:bg-brand" : ""
                              }`}
                            >
                              <Avatar
                                {...nameParts(friend)}
                                avatarUrl={avatarUrlFor(friend)}
                                seed={friend.id}
                                linked={friend.linkedUserId !== null}
                              />
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{friend.name}</span>
                                <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{friend.role || friend.email}</span>
                              </span>
                              <span className="flex shrink-0 gap-1 text-sm" aria-hidden="true">
                                {friend.isGuardian ? <span title="Guardiano">🛡️</span> : null}
                                {friend.isFriend ? <span title="Amico">🤝</span> : null}
                                {friend.status === "revoked" ? <span title="Revocato">⛔</span> : null}
                              </span>
                              <span className="text-zinc-300 md:hidden dark:text-zinc-600" aria-hidden="true">
                                ›
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* L'indice a lettere: salta alla lettera; le lettere senza nessuno sono spente. */}
          <nav aria-label="Indice a lettere" className="flex w-5 shrink-0 flex-col items-center justify-between py-1 md:w-6">
            {ALPHABET.map((letter) => {
              const on = letters.has(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!on}
                  onClick={() => jumpTo(letter)}
                  aria-label={`Vai alla lettera ${letter}`}
                  className={`h-[3.4%] min-h-[14px] w-full rounded text-[10px] leading-none font-bold ${
                    on ? "text-brand hover:bg-brand hover:text-white" : "cursor-default text-zinc-300 dark:text-zinc-700"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      {/* La scheda della persona: su smartphone occupa lo schermo, con il tasto per tornare alla rubrica. */}
      {shown ? (
        <section
          key={shown.id}
          aria-label={`Scheda di ${shown.name}`}
          className={`${detailOnMobile ? "flex" : "hidden md:flex"} min-w-0 animate-[rubrica-in_0.3s_ease_both] flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950`}
        >
          <button
            type="button"
            onClick={backToList}
            className="-mb-1 flex items-center gap-1 self-start text-sm font-semibold text-brand hover:underline md:hidden"
          >
            ← Rubrica
          </button>

          <div className="flex items-start gap-4">
            <Avatar
              {...nameParts(shown)}
              avatarUrl={avatarUrlFor(shown)}
              seed={shown.id}
              size="lg"
              linked={shown.linkedUserId !== null}
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-2xl leading-tight font-extrabold tracking-tight break-words text-zinc-900 dark:text-zinc-100">{shown.name}</h2>
              {shown.role ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{shown.role}</p> : null}
            </div>
            {renderMenu(shown)}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[shown.status]}`}>{STATUS_LABEL[shown.status]}</span>
            {shown.isFriend ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">🤝 Amico</span>
            ) : null}
            {shown.isGuardian ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">🛡️ Guardiano</span>
            ) : null}
            {isFriendRequestPending(shown) ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">Amicizia in attesa</span>
            ) : null}
            {shown.linkedUserId !== null ? (
              <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-zinc-800 dark:text-emerald-400">
                Ha un account Hinthial
              </span>
            ) : null}
          </div>

          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-zinc-500 dark:text-zinc-400">Email</dt>
              <dd className="min-w-0 font-medium break-all text-zinc-900 dark:text-zinc-100">{shown.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-zinc-500 dark:text-zinc-400">In rubrica</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">dal {formatDate(shown.createdAt)}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-extrabold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">Capsule per {nameParts(shown).firstName || shown.name}</h3>
            {capsulesFor(shown).length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessuna capsula affidata a {nameParts(shown).firstName || shown.name}.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {capsulesFor(shown).map((capsule) => (
                  <li key={capsule.id} className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <span aria-hidden="true">📦</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">{capsule.title}</span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                        creata il {formatDate(capsule.createdAt)}
                        {capsule.openAt ? ` · apertura prevista ${formatDateTime(capsule.openAt)}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {canRequestFriendship(shown) ? (
              <button
                type="button"
                disabled={busyId === shown.id}
                onClick={() => onRequestFriendship(shown)}
                className="rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
              >
                Richiedi amicizia
              </button>
            ) : null}
            {shown.isFriend ? (
              <button
                type="button"
                disabled={busyId === shown.id || isGuardianRequestPending(shown)}
                onClick={() => onToggleGuardian(shown)}
                className="rounded-xl border border-zinc-300 px-3.5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {shown.isGuardian
                  ? "Rimuovi dai guardiani"
                  : isGuardianRequestPending(shown)
                    ? "Richiesta di guardiano in attesa"
                    : "Chiedi di diventare guardiano"}
              </button>
            ) : null}
            <Link
              href={`/friends/${shown.id}/edit`}
              className="rounded-xl border border-zinc-300 px-3.5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Modifica
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
