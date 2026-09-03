"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import {
  deleteTrustedContact,
  listTrustedContacts,
  setTrustedContactStatus,
  updateTrustedContact,
} from "@/domain/contacts/repository";
import { listCapsules } from "@/domain/capsules/repository";
import { SearchInput } from "@/components/ui/SearchInput";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ListViewToggle } from "@/components/ui/ListViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";
import { useListViewPreferences } from "@/components/layout/ListViewPreferencesProvider";
import { TABLE_PAGE_SIZE } from "@/lib/list-view";
import { applySort, toggleSort, type SortState } from "@/lib/table-sort";
import type { TrustedContactListItem, TrustedContactStatus } from "@/domain/contacts/types";
import type { CapsuleListItem } from "@/domain/capsules/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<TrustedContactStatus, string> = {
  pending: "In attesa",
  active: "Attivo",
  revoked: "Revocato",
};

const STATUS_BADGE_CLASS: Record<TrustedContactStatus, string> = {
  pending:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  active: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  revoked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

type SortColumn = "name" | "email" | "role" | "status" | "capsules";

/** Al passaggio del mouse, l'elenco delle capsule che indicano questo contatto tra i destinatari. */
function CapsulesBadge({ capsules }: { capsules: CapsuleListItem[] }) {
  if (capsules.length === 0) return null;

  return (
    <span className="group relative inline-flex shrink-0">
      <span className="cursor-default rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        📦 {capsules.length} {capsules.length === 1 ? "capsula" : "capsule"}
      </span>
      <span className="invisible absolute left-0 top-full z-10 mt-1 w-64 rounded-md border border-zinc-200 bg-white p-2 text-xs text-zinc-700 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
        <ul className="flex flex-col gap-1.5">
          {capsules.map((capsule) => (
            <li key={capsule.id}>
              <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {capsule.title}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400">
                creata il {formatDate(capsule.createdAt)}
                {capsule.openAt ? ` · apertura prevista ${formatDate(capsule.openAt)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </span>
    </span>
  );
}

/**
 * FASE 7 --- Contatto fiduciario: solo struttura dati e gestione dello
 * stato, nessuno sblocco automatico dei dati (v. HINTHIAL_MVP.md).
 */
export function TrustedContactsPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [contacts, setContacts] = useState<TrustedContactListItem[]>([]);
  const [capsules, setCapsules] = useState<CapsuleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TrustedContactStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState<SortColumn> | null>({ key: "name", direction: "asc" });

  const { modeFor } = useListViewPreferences();
  const viewMode = modeFor("contacts");

  // "?created=1" arriva da /contacts/new dopo un salvataggio riuscito ---
  // v. CapsulesPanel.tsx per il motivo dello stato pigro qui sotto.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  useEffect(() => {
    if (showCreatedMessage) router.replace("/contacts");
  }, [showCreatedMessage, router]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [contactsResult, capsulesResult] = await Promise.all([
        listTrustedContacts(supabase, masterKey),
        listCapsules(supabase, masterKey),
      ]);
      setContacts(contactsResult);
      setCapsules(capsulesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i contatti fiduciari.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function startEditing(contact: TrustedContactListItem) {
    setEditingId(contact.id);
    setEditName(contact.name);
    setEditEmail(contact.email);
    setEditRole(contact.role);
  }

  async function handleSaveEdit(contact: TrustedContactListItem) {
    const name = editName.trim();
    const email = editEmail.trim();
    const role = editRole.trim();

    if (!name || !email || !role) {
      setError("Compila nome, email e ruolo.");
      return;
    }

    setBusyId(contact.id);
    setError(null);
    try {
      await updateTrustedContact(supabase, masterKey, contact.id, { name, email, role });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare il contatto fiduciario.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetStatus(contact: TrustedContactListItem, status: TrustedContactStatus) {
    setBusyId(contact.id);
    setError(null);
    try {
      await setTrustedContactStatus(supabase, contact.id, status);
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, status } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare lo stato del contatto.");
    } finally {
      setBusyId(null);
    }
  }

  function capsulesFor(contact: TrustedContactListItem): CapsuleListItem[] {
    return capsules.filter((capsule) => capsule.relatedContacts.some((c) => c.id === contact.id));
  }

  function sortValueFor(contact: TrustedContactListItem, column: SortColumn): string {
    switch (column) {
      case "name":
        return contact.name;
      case "email":
        return contact.email;
      case "role":
        return contact.role;
      case "status":
        return STATUS_LABEL[contact.status];
      case "capsules":
        return String(capsulesFor(contact).length);
    }
  }

  function handleSort(column: SortColumn) {
    setSort((prev) => toggleSort(prev, column));
  }

  const filteredContacts = contacts
    .filter((contact) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return true;
      return [contact.name, contact.email, contact.role].join(" ").toLowerCase().includes(normalized);
    })
    .filter((contact) => statusFilter === "all" || contact.status === statusFilter);

  // Solo la vista a tabella si ordina --- l'elenco resta cronologico.
  const sortedContacts = applySort(filteredContacts, sort, sortValueFor);

  // Si riclampa invece di resettare con un effect: se un filtro riduce i
  // risultati, la pagina torna da sola entro il range valido.
  const pageCount = Math.max(1, Math.ceil(filteredContacts.length / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedContacts = sortedContacts.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  );

  async function handleDelete(contact: TrustedContactListItem) {
    if (!window.confirm(`Eliminare il contatto fiduciario "${contact.name}"?`)) return;

    setBusyId(contact.id);
    setError(null);
    try {
      await deleteTrustedContact(supabase, contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il contatto fiduciario.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Contatti fiduciari
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Persone che potranno essere autorizzate in futuro ad accedere ai tuoi dati. Per ora
            questa sezione registra solo il contatto e il suo stato --- nessun accesso viene
            concesso automaticamente.
          </p>
        </div>
        <Link
          href="/contacts/new"
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          + Aggiungi contatto
        </Link>
      </div>

      {showCreatedMessage ? (
        <p className="text-sm text-lime-700 dark:text-lime-400">✅ Contatto aggiunto.</p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessun contatto fiduciario ancora. Aggiungine uno col tasto qui sopra.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Cerca per nome, email o ruolo…" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TrustedContactStatus | "all")}
              aria-label="Filtra per stato"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="all">Tutti</option>
              <option value="pending">In attesa</option>
              <option value="active">Attivi</option>
              <option value="revoked">Revocati</option>
            </select>
            <ListViewToggle section="contacts" />
          </div>

          {filteredContacts.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessun contatto corrisponde alla ricerca.
            </p>
          ) : viewMode === "table" ? (
            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <SortableColumnHeader label="Nome" sortKey="name" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader label="Email" sortKey="email" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader label="Ruolo" sortKey="role" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader label="Stato" sortKey="status" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader
                        label="Capsule"
                        sortKey="capsules"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <th className="p-3">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {pagedContacts.map((contact) => {
                      const busy = busyId === contact.id;
                      const isEditing = editingId === contact.id;

                      if (isEditing) {
                        return (
                          <tr key={contact.id}>
                            <td colSpan={6} className="p-4">
                              <div className="flex flex-col gap-3">
                                <div className="flex flex-wrap gap-3">
                                  <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
                                    <label
                                      htmlFor={`edit-${contact.id}-name`}
                                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                                    >
                                      Nome
                                    </label>
                                    <input
                                      id={`edit-${contact.id}-name`}
                                      type="text"
                                      value={editName}
                                      onChange={(e) => setEditName(e.target.value)}
                                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                                    />
                                  </div>
                                  <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
                                    <label
                                      htmlFor={`edit-${contact.id}-email`}
                                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                                    >
                                      Email
                                    </label>
                                    <input
                                      id={`edit-${contact.id}-email`}
                                      type="email"
                                      value={editEmail}
                                      onChange={(e) => setEditEmail(e.target.value)}
                                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label
                                      htmlFor={`edit-${contact.id}-role`}
                                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                                    >
                                      Ruolo
                                    </label>
                                    <input
                                      id={`edit-${contact.id}-role`}
                                      type="text"
                                      value={editRole}
                                      onChange={(e) => setEditRole(e.target.value)}
                                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleSaveEdit(contact)}
                                    className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                                  >
                                    {busy ? "Salvataggio…" : "Salva"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => setEditingId(null)}
                                    className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                                  >
                                    Annulla
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={contact.id}>
                          <td className="max-w-[12rem] truncate p-3 font-medium text-zinc-900 dark:text-zinc-100">
                            {contact.name}
                          </td>
                          <td className="max-w-[14rem] truncate p-3 text-zinc-600 dark:text-zinc-400">
                            {contact.email}
                          </td>
                          <td className="max-w-[10rem] truncate p-3 text-zinc-600 dark:text-zinc-400">
                            {contact.role}
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[contact.status]}`}
                            >
                              {STATUS_LABEL[contact.status]}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">
                            {capsulesFor(contact).length}
                          </td>
                          <td className="p-3">
                            <RowActionsMenu label={`Azioni per ${contact.name}`}>
                              {contact.status === "pending" ? (
                                <RowMenuItem disabled={busy} onClick={() => handleSetStatus(contact, "active")}>
                                  Segna come attivo
                                </RowMenuItem>
                              ) : null}
                              {contact.status !== "revoked" ? (
                                <RowMenuItem disabled={busy} onClick={() => handleSetStatus(contact, "revoked")}>
                                  Revoca
                                </RowMenuItem>
                              ) : null}
                              <RowMenuItem disabled={busy} onClick={() => startEditing(contact)}>
                                Modifica
                              </RowMenuItem>
                              <RowMenuItem disabled={busy} danger onClick={() => handleDelete(contact)}>
                                Elimina
                              </RowMenuItem>
                            </RowActionsMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {filteredContacts.map((contact) => {
                const busy = busyId === contact.id;
                const isEditing = editingId === contact.id;

                if (isEditing) {
                  return (
                    <li key={contact.id} className="flex flex-col gap-3 p-4">
                      <div className="flex flex-wrap gap-3">
                        <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
                          <label
                            htmlFor={`edit-${contact.id}-name`}
                            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                          >
                            Nome
                          </label>
                          <input
                            id={`edit-${contact.id}-name`}
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                          />
                        </div>
                        <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
                          <label
                            htmlFor={`edit-${contact.id}-email`}
                            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                          >
                            Email
                          </label>
                          <input
                            id={`edit-${contact.id}-email`}
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={`edit-${contact.id}-role`}
                            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                          >
                            Ruolo
                          </label>
                          <input
                            id={`edit-${contact.id}-role`}
                            type="text"
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSaveEdit(contact)}
                          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                        >
                          {busy ? "Salvataggio…" : "Salva"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setEditingId(null)}
                          className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                        >
                          Annulla
                        </button>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={contact.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      {/* div, non p: la nuvoletta di CapsulesBadge contiene <ul>/<li>, non ammessi dentro un <p>. */}
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {contact.name}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[contact.status]}`}
                        >
                          {STATUS_LABEL[contact.status]}
                        </span>
                        <CapsulesBadge capsules={capsulesFor(contact)} />
                      </div>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {contact.email} · {contact.role} · dal {formatDate(contact.createdAt)}
                      </p>
                    </div>
                    <RowActionsMenu label={`Azioni per ${contact.name}`}>
                      {contact.status === "pending" ? (
                        <RowMenuItem disabled={busy} onClick={() => handleSetStatus(contact, "active")}>
                          Segna come attivo
                        </RowMenuItem>
                      ) : null}
                      {contact.status !== "revoked" ? (
                        <RowMenuItem disabled={busy} onClick={() => handleSetStatus(contact, "revoked")}>
                          Revoca
                        </RowMenuItem>
                      ) : null}
                      <RowMenuItem disabled={busy} onClick={() => startEditing(contact)}>
                        Modifica
                      </RowMenuItem>
                      <RowMenuItem disabled={busy} danger onClick={() => handleDelete(contact)}>
                        Elimina
                      </RowMenuItem>
                    </RowActionsMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
