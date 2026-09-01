"use client";

import { sortAlphabetically } from "@/lib/utils";
import type { ReferenceResolution } from "@/domain/import/types";

const CREATE_VALUE = "__create__";

/**
 * One cell of the step-4 preview table for a name -> id reference
 * (Asset -> Categoria, Scadenza -> Asset): shows the resolved name when
 * it matched, a dash when the CSV cell was empty (an optional field),
 * or --- when it didn't match anything existing --- an inline select to
 * either pick the right existing one or create a new one on the spot.
 * Same interaction for both kinds of reference, only the label passed
 * in changes ("categoria"/"asset").
 */
export function ReferenceCell({
  resolution,
  existing,
  onChange,
  entityLabel,
}: {
  resolution: ReferenceResolution;
  existing: { id: string; name: string }[];
  onChange: (next: ReferenceResolution) => void;
  entityLabel: string;
}) {
  if (resolution.kind === "empty") {
    return <span className="text-zinc-400 dark:text-zinc-600">—</span>;
  }

  if (resolution.kind === "matched") {
    return <span className="text-zinc-700 dark:text-zinc-300">{resolution.name}</span>;
  }

  if (resolution.kind === "create") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-lime-700 dark:text-lime-400">
          Verrà creato/a: &quot;{resolution.rawName}&quot;
        </span>
        <button
          type="button"
          onClick={() => onChange({ kind: "unresolved", rawName: resolution.rawName })}
          className="text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          annulla
        </button>
      </div>
    );
  }

  // "unresolved" --- the CSV named something that doesn't exist yet.
  const sorted = sortAlphabetically(existing, (e) => e.name);
  return (
    <select
      value=""
      onChange={(e) => {
        const value = e.target.value;
        if (value === "") return;
        if (value === CREATE_VALUE) {
          onChange({ kind: "create", rawName: resolution.rawName });
          return;
        }
        const match = existing.find((item) => item.id === value);
        if (match) onChange({ kind: "matched", id: match.id, name: match.name });
      }}
      className="rounded-md border border-red-400 bg-white px-2 py-1 text-xs text-zinc-950 dark:border-red-700 dark:bg-zinc-950 dark:text-zinc-50"
    >
      <option value="">
        &quot;{resolution.rawName}&quot; non trovato/a: scegli {entityLabel}
      </option>
      {sorted.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
      <option value={CREATE_VALUE}>+ Crea {entityLabel} &quot;{resolution.rawName}&quot;</option>
    </select>
  );
}
