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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessun contatto fiduciario ancora. Aggiungine uno col tasto qui sopra.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {contacts.map((contact) => {
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
                <div className="flex shrink-0 gap-3">
                  {contact.status === "pending" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSetStatus(contact, "active")}
                      className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                    >
                      Segna come attivo
                    </button>
                  ) : null}
                  {contact.status !== "revoked" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSetStatus(contact, "revoked")}
                      className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                    >
                      Revoca
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startEditing(contact)}
                    className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    Modifica
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(contact)}
                    className="text-sm font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    Elimina
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
