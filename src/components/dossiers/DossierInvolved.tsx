"use client";

import { useState } from "react";
import Link from "next/link";
import { initialsOf, MAX_PERSON_NAME_LENGTH, MAX_PERSON_ROLE_LENGTH, type DossierPerson } from "@/domain/dossiers/items";
import { CARD, CARD_TITLE, SMALL_BUTTON, TEXT_INPUT } from "@/components/dossiers/styles";

/** Chi e cosa c'entra con la vicenda: i beni dei documenti (si ricavano) e le persone (le scrivi tu: nome e ruolo). */
export function DossierInvolved({
  assets,
  people,
  busy,
  adding,
  canAddPeople,
  onAddPerson,
  onDeletePerson,
}: {
  assets: { id: string; name: string; count: number }[];
  people: DossierPerson[];
  busy: boolean;
  adding: boolean;
  /** Falso se le persone non si possono salvare (migrazione non applicata) o il fascicolo è chiuso. */
  canAddPeople: boolean;
  onAddPerson: (name: string, role: string) => void;
  onDeletePerson: (person: DossierPerson) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [formOpen, setFormOpen] = useState(adding);

  function submit() {
    if (!name.trim()) return;
    onAddPerson(name, role);
    setName("");
    setRole("");
  }

  return (
    <section aria-label="Coinvolti" className={CARD}>
      <h2 className={CARD_TITLE}>Coinvolti</h2>
      <ul className="flex flex-col gap-2.5">
        {assets.map((asset) => (
          <li key={asset.id} className="flex items-center gap-2.5">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#e0f2f2]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0f8b8d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 11l9-8 9 8" />
                <path d="M5 10v10h14V10" />
              </svg>
            </span>
            <span className="flex min-w-0 flex-col">
              <Link href="/assets" className="truncate text-[13.5px] font-bold hover:text-brand">
                {asset.name}
              </Link>
              <span className="text-xs text-[#5b6483] dark:text-zinc-400">
                Bene · {asset.count} {asset.count === 1 ? "documento" : "documenti"} in questo fascicolo
              </span>
            </span>
          </li>
        ))}
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-2.5">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#e8edfc] text-xs font-extrabold text-[#2b4fc4]"
              aria-hidden="true"
            >
              {initialsOf(person.name)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13.5px] font-bold">{person.name}</span>
              {person.role ? <span className="text-xs break-words text-[#5b6483] dark:text-zinc-400">{person.role}</span> : null}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDeletePerson(person)}
              aria-label={`Togli ${person.name}`}
              className="shrink-0 rounded-md px-1.5 text-base leading-none text-[#8a91ad] hover:text-red-600 disabled:opacity-50"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {!canAddPeople ? null : formOpen ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={name}
            maxLength={MAX_PERSON_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome (Notaio Rossi)"
            aria-label="Nome della persona"
            className={TEXT_INPUT}
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={role}
              maxLength={MAX_PERSON_ROLE_LENGTH}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Ruolo (rogito 18 ott)"
              aria-label="Ruolo della persona"
              className={`${TEXT_INPUT} flex-1`}
            />
            <button type="button" disabled={busy || !name.trim()} onClick={submit} className={SMALL_BUTTON}>
              Aggiungi
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setFormOpen(true)} className="self-start text-[13px] font-bold text-brand hover:underline">
          + Aggiungi una persona
        </button>
      )}
    </section>
  );
}
