"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { SidePanel } from "@/components/ui/SidePanel";
import type { AuditFilterParams } from "@/domain/audit/filters";
import type { AuditEventListItem } from "@/domain/audit/types";
import { ErrorText } from "@/components/ui/ErrorText";
import { LoadingText } from "@/components/ui/LoadingText";
import { AuditEventDetail } from "@/components/settings/audit/AuditEventDetail";
import { AuditEventTable } from "@/components/settings/audit/AuditEventTable";
import { AuditFilterForm } from "@/components/settings/audit/AuditFilterForm";
import { AuditPager } from "@/components/settings/audit/AuditPager";
import { useAuditEvents } from "@/components/settings/audit/useAuditEvents";
import { useAuditFilters } from "@/components/settings/audit/useAuditFilters";
import { useAuditLabels } from "@/components/settings/audit/useAuditLabels";

/**
 * Impostazioni -> Attività: l'unico posto dove si consulta il registro eventi (v. lib/audit/log-event.ts). Filtri
 * nell'URL (si condividono, resistono al ricarica e al tasto indietro), elenco impaginato dal server, caricato subito.
 * Il registro contiene solo tipo di evento, metadati tecnici e il riferimento all'item (tipo + id): il nome
 * dell'elemento lo decifra il browser a vault sbloccato, oppure arriva dal titolo cifrato salvato nelle eliminazioni
 * definitive. A vault bloccato resta il solo tipo, e la pagina resta usabile.
 *
 * Qui solo la composizione: i filtri, gli eventi e le etichette vivono ciascuno nel proprio hook (cartella `audit/`).
 */
export function AuditLogPanel({ initialParams = {} }: { initialParams?: AuditFilterParams }) {
  const supabase = useState(() => createClient())[0];
  // Le schede di Impostazioni montano il pannello sia nel layout mobile sia in quello desktop: gli id non possono essere fissi.
  const uid = useId();
  const { status } = useMasterKey();
  const masterKey = status.kind === "unlocked" ? status.masterKey : null;

  const { filters, commit, change, toggleType, activeFilters } = useAuditFilters(initialParams);
  const { result, loading, error, events, total, pageCount } = useAuditEvents(supabase, filters, commit);
  const { fieldLabels, elements, elementLabels, elementLabel } = useAuditLabels(supabase, masterKey, result?.data.events);

  // `selected` non torna mai a null da sola: solo `panelOpen` decide se il pannello è aperto, così il contenuto resta quello dell'ultimo evento durante l'animazione di uscita.
  const [selected, setSelected] = useState<AuditEventListItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  function openDetail(event: AuditEventListItem) {
    setSelected(event);
    setPanelOpen(true);
  }

  function showEntityActivity(event: AuditEventListItem) {
    if (!event.entityType || !event.entityId) return;
    setPanelOpen(false);
    change({ entity: { type: event.entityType, id: event.entityId } });
  }

  return (
    <div className="flex flex-col gap-4">

      <AuditFilterForm
        uid={uid}
        filters={filters}
        activeFilters={activeFilters}
        elements={elements}
        elementLabels={elementLabels}
        onChange={change}
        onCommit={commit}
        onToggleType={toggleType}
      />

      {error ? (
        <ErrorText>
          {error}
        </ErrorText>
      ) : null}

      {!result && !error ? (
        <LoadingText />
      ) : result && total === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {activeFilters > 0 ? "Nessuna attività trovata con questi filtri." : "Nessuna attività registrata."}
          </p>
        </div>
      ) : result ? (
        <AuditEventTable
          events={events}
          loading={loading}
          fieldLabels={fieldLabels}
          elementLabel={elementLabel}
          onOpen={openDetail}
        />
      ) : null}

      {result && total > 0 ? (
        <AuditPager uid={uid} filters={filters} total={total} pageCount={pageCount} onChange={change} onCommit={commit} />
      ) : null}

      <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} label="Dettaglio attività">
        {selected ? (
          <AuditEventDetail
            selected={selected}
            fieldLabels={fieldLabels}
            elementLabel={elementLabel}
            onClose={() => setPanelOpen(false)}
            onShowEntityActivity={showEntityActivity}
          />
        ) : null}
      </SidePanel>
    </div>
  );
}
