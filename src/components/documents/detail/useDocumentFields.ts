"use client";

import { useEffect, useRef, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { updateDocumentMetadata } from "@/domain/documents/repository";
import {
  documentToFields,
  type DocumentMetadataFieldsValue,
} from "@/components/documents/DocumentMetadataFields";
import { useToast } from "@/components/ui/ToastProvider";
import type { DocumentListItem } from "@/domain/documents/types";
import { errorMessage } from "@/lib/utils";

/** Confronto per valore, senza voci vuote né ordine: una voce svuotata equivale a una rimossa. */
function normalizeStructuredFields(fields: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(fields)
      .filter(([, value]) => value.trim() !== "")
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * Fusione Scheda/Modifica: i metadati modificabili, sempre live qui (mai una pagina a parte), con il titolo e le voci
 * libere. Le proposte (Scadenza/Categoria/Emittente) scrivono direttamente su `doc` via acceptProposal, non su questo
 * stato --- v. gli effect più sotto, che li tengono sincronizzati uno per uno: un ricalcolo unico sovrascriverebbe una
 * modifica in corso su un ALTRO campo non toccato dalla proposta.
 */
export function useDocumentFields(
  masterKey: CryptoKey,
  documentId: string,
  doc: DocumentListItem | null,
  refresh: () => Promise<void>,
  setError: (message: string | null) => void,
) {
  const supabase = useSupabase();
  const showToast = useToast();

  // `null` finché il documento non è ancora caricato.
  const [fields, setFields] = useState<DocumentMetadataFieldsValue | null>(null);
  const [savingFields, setSavingFields] = useState(false);
  // Alla prima lettura del documento si parte dai suoi valori; dopo, `fields` è di chi sta modificando.
  if (doc && fields === null) setFields(documentToFields(doc));

  // Voci libere della Scheda (numero polizza, data di nascita, ...), modificabili come gli altri campi e salvate
  // con "Salva modifiche". Si risincronizzano da `doc` chiave per chiave, non in blocco: dopo un'accettazione
  // cambia solo quella chiave, e una modifica in corso su un'altra non va sovrascritta.
  // Titolo (il nome del contenuto), modificabile in Scheda e salvato con "Salva modifiche". `null` finché il documento non è caricato.
  const [titleValue, setTitleValue] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- risincronizza il titolo da `doc` (cambia solo dopo un salvataggio o un ricaricamento).
    setTitleValue(doc?.filename ?? null);
  }, [doc?.filename]);

  const [structuredValues, setStructuredValues] = useState<Record<string, string> | null>(null);
  const prevStructuredRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const next = doc?.structuredFields ?? {};
    const prev = prevStructuredRef.current;
    prevStructuredRef.current = next;
    setStructuredValues((current) => {
      if (current === null) return { ...next };
      const merged = { ...current };
      for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
        if (prev[key] === next[key]) continue;
        if (next[key] === undefined) delete merged[key];
        else merged[key] = next[key];
      }
      return merged;
    });
  }, [doc?.structuredFields]);

  // Sincronizzano UN campo alla volta da `doc` a `fields` quando una proposta lo scrive --- mai un ricalcolo
  // unico dell'intero oggetto, che sovrascriverebbe una modifica in corso su un campo diverso (v. commento sopra).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- risincronizza `fields` da `doc`, non solo un DOM esterno.
    setFields((prev) => (prev ? { ...prev, categoryId: doc?.categoryId ?? "" } : prev));
  }, [doc?.categoryId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- v. sopra.
    setFields((prev) =>
      prev ? { ...prev, expiresAt: doc?.expiresAt ? doc.expiresAt.slice(0, 10) : "" } : prev,
    );
  }, [doc?.expiresAt]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- v. sopra.
    setFields((prev) => (prev ? { ...prev, issuer: doc?.issuer ?? "" } : prev));
  }, [doc?.issuer]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- v. sopra: il bene collegato da una proposta.
    setFields((prev) => (prev ? { ...prev, relatedAssetId: doc?.relatedAssetId ?? "" } : prev));
  }, [doc?.relatedAssetId]);

  // Disabilita "Salva modifiche" quando non c'è nulla da salvare --- confronto per valore, non per riferimento:
  // `fields` è un oggetto nuovo a ogni onChange anche quando il contenuto torna uguale (es. una proposta accettata
  // e poi risincronizzata dagli effect sopra).
  const structuredDirty =
    doc !== null &&
    structuredValues !== null &&
    normalizeStructuredFields(structuredValues) !== normalizeStructuredFields(doc.structuredFields);
  const titleDirty = doc !== null && titleValue !== null && titleValue.trim() !== doc.filename;
  const fieldsDirty =
    doc !== null &&
    ((fields !== null && JSON.stringify(fields) !== JSON.stringify(documentToFields(doc))) ||
      structuredDirty ||
      titleDirty);

  /** Fusione Scheda/Modifica: non più una pagina a parte (v. EditArchiveItemForm, ora rimossa). */
  async function handleSaveFields() {
    if (!fields) return;
    if (titleValue !== null && titleValue.trim() === "") {
      setError("Il titolo non può essere vuoto.");
      return;
    }
    setSavingFields(true);
    setError(null);
    try {
      await updateDocumentMetadata(supabase, masterKey, documentId, {
        categoryId: fields.categoryId || null,
        relatedAssetId: fields.relatedAssetId || null,
        dossierIds: fields.dossierIds,
        expiresAt: fields.expiresAt || null,
        notes: fields.notes,
        issuer: fields.issuer,
        ...(structuredDirty && structuredValues ? { structuredFields: structuredValues } : {}),
        ...(titleDirty && titleValue !== null ? { title: titleValue } : {}),
      });
      await refresh();
      showToast("Modifiche salvate.");
    } catch (err) {
      setError(errorMessage(err, "Impossibile aggiornare il contenuto."));
    } finally {
      setSavingFields(false);
    }
  }

  return {
    fields,
    setFields,
    titleValue,
    setTitleValue,
    structuredValues,
    setStructuredValues,
    savingFields,
    fieldsDirty,
    handleSaveFields,
  };
}
