"use client";

import { useState } from "react";
import { sortAlphabetically } from "@/lib/utils";
import type { TrustedContactListItem } from "@/domain/contacts/types";

const AVATAR_COLORS = ["bg-brand", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-pink-500"];

/** Deterministico (stesso contatto, sempre lo stesso colore) --- solo per distinguerli a colpo d'occhio, come Avatar.tsx. */
function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const initials = `${parts[0]?.charAt(0) ?? ""}${parts[1]?.charAt(0) ?? ""}`.toUpperCase();
  return initials || "?";
}

/**
 * Lets the user pick one or more trusted contacts as a capsule's
 * recipients --- only ATTIVI contacts are proposable (per esplicita
 * richiesta). "+ Aggiungi" adds the chosen one to the running list,
 * mirroring DocumentAttachmentPicker's pattern. I destinatari già
 * scelti sono mostrati come si indirizzerebbe una busta (iniziali +
 * nome), non un elenco anonimo --- v. richiesta utente, "capsule come
 * lettere".
 */
export function ContactPicker({
  idPrefix,
  contacts,
  selected,
  onChange,
}: {
  idPrefix: string;
  contacts: TrustedContactListItem[];
  selected: TrustedContactListItem[];
  onChange: (next: TrustedContactListItem[]) => void;
}) {
  const [contactId, setContactId] = useState("");

  const selectedIds = new Set(selected.map((c) => c.id));
  const pickableContacts = sortAlphabetically(
    contacts.filter((c) => !selectedIds.has(c.id)),
    (c) => c.name,
  );

  function handleAdd() {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    onChange([...selected, contact]);
    setContactId("");
  }

  function handleRemove(id: string) {
    onChange(selected.filter((c) => c.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            A
          </span>
          <ul className="flex flex-wrap items-center gap-2">
            {selected.map((contact) => (
              <li
                key={contact.id}
                className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1.5 pr-1 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white ${colorFor(contact.id)}`}
                >
                  {initialsOf(contact.name)}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{contact.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(contact.id)}
                  aria-label={`Rimuovi ${contact.name}`}
                  className="rounded-full px-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${idPrefix}-contact`}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Destinatario
          </label>
          <select
            id={`${idPrefix}-contact`}
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            disabled={pickableContacts.length === 0}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="">
              {pickableContacts.length > 0 ? "Scegli un contatto" : "Nessun contatto attivo"}
            </option>
            {pickableContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={!contactId}
          onClick={handleAdd}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          + Aggiungi
        </button>
      </div>
    </div>
  );
}
