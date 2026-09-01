"use client";

import { useState } from "react";
import { sortAlphabetically } from "@/lib/utils";
import type { TrustedContactListItem } from "@/domain/contacts/types";

/**
 * Lets the user pick one or more trusted contacts as a capsule's
 * recipients --- only ATTIVI contacts are proposable (per esplicita
 * richiesta). "+ Aggiungi" adds the chosen one to the running list,
 * mirroring DocumentAttachmentPicker's pattern.
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
    <div className="flex flex-col gap-2">
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

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {selected.map((contact) => (
            <li
              key={contact.id}
              className="flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <span>👤 {contact.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(contact.id)}
                aria-label={`Rimuovi ${contact.name}`}
                className="rounded-full px-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
