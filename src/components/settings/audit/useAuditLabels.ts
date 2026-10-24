"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { listAuditElements, auditElementKey, type AuditElementOption } from "@/domain/audit/elements";
import { listFieldVocabulary } from "@/domain/structured-fields/vocabulary";
import { decryptAuditLabel } from "@/lib/audit/label";
import { AUDIT_ENTITY_TYPE_LABEL } from "@/domain/audit/labels";
import type { AuditEventListItem } from "@/domain/audit/types";

/**
 * Le etichette leggibili del registro. Il registro contiene solo tipo di evento, metadati tecnici e il riferimento
 * all'item (tipo + id): il nome dell'elemento lo decifra il browser a vault sbloccato, oppure arriva dal titolo
 * cifrato salvato nelle eliminazioni definitive. A vault bloccato resta il solo tipo, e la pagina resta usabile.
 */
export function useAuditLabels(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey | null,
  pageEvents: AuditEventListItem[] | undefined,
) {
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [loadedElements, setLoadedElements] = useState<AuditElementOption[] | null>(null);
  const [deletedLabels, setDeletedLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    listFieldVocabulary(supabase)
      .then((entries) => {
        if (!cancelled) setFieldLabels(Object.fromEntries(entries.map((entry) => [entry.fieldKey, entry.label])));
      })
      .catch(() => {
        // Senza vocabolario le proposte mostrano la chiave del campo: il registro resta leggibile.
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!masterKey) return;
    let cancelled = false;
    listAuditElements(supabase, masterKey).then((options) => {
      if (!cancelled) setLoadedElements(options);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, masterKey]);

  useEffect(() => {
    if (!masterKey || !pageEvents) return;
    let cancelled = false;
    const withLabel = pageEvents.filter((event) => event.encryptedLabel);
    Promise.all(
      withLabel.map(async (event) => [event.id, await decryptAuditLabel(masterKey, event.encryptedLabel!)] as const),
    ).then((entries) => {
      if (cancelled) return;
      const decrypted = entries.filter((entry): entry is readonly [string, string] => entry[1] !== null);
      if (decrypted.length > 0) setDeletedLabels((prev) => ({ ...prev, ...Object.fromEntries(decrypted) }));
    });
    return () => {
      cancelled = true;
    };
  }, [masterKey, pageEvents]);

  // A vault bloccato non si mostra l'elenco rimasto in memoria da prima del blocco.
  const elements = masterKey ? loadedElements : null;
  const elementLabels = useMemo(
    () => new Map((elements ?? []).map((element) => [auditElementKey(element.type, element.id), element.label])),
    [elements],
  );

  function elementLabel(event: AuditEventListItem): string | null {
    if (!event.entityType || !event.entityId) return null;
    const typeLabel = AUDIT_ENTITY_TYPE_LABEL[event.entityType];
    const known = elementLabels.get(auditElementKey(event.entityType, event.entityId));
    if (known) return known;
    const deleted = deletedLabels[event.id];
    if (deleted) return `${deleted} (eliminato)`;
    // Con l'elenco caricato e l'item assente, è stato eliminato; senza elenco (vault bloccato) non si può dire altro che il tipo.
    return elements ? `${typeLabel} non più presente` : typeLabel;
  }

  return { fieldLabels, elements, elementLabels, elementLabel };
}

export type AuditLabels = ReturnType<typeof useAuditLabels>;
