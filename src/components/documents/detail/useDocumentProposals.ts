"use client";

import { useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  acceptProposal,
  type AcceptedProposal,
  rejectProposal,
  undoAcceptance,
  undoRejection,
} from "@/domain/proposals/repository";
import { pastEventsOf } from "@/domain/ai/analyze-document";
import { buildAnalysisOverview } from "@/domain/ai/analysis/overview";
import { localDateKey } from "@/domain/reminders/repository";
import type { Proposal, ProposalRejection } from "@/domain/proposals/types";
import { onePerSlot, proposalsForDocument } from "@/domain/proposals/for-document";
import type { UndoableAction } from "@/components/documents/ReadingRegister";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/utils";
import type { DocumentData } from "@/components/documents/detail/useDocumentData";

/**
 * Le proposte di Silva su questo contenuto: quelle ancora da decidere (ricalcolate a ogni render, così accettare o
 * rifiutare ne filtra da sola), le azioni per accettarle, rifiutarle o riprenderle, e l'ultima azione annullabile.
 */
export function useDocumentProposals(masterKey: CryptoKey, data: DocumentData) {
  const supabase = useSupabase();
  const { doc, categories, assets, linkedFields, rejections, reminderDates, typeCategories, refresh, setError } = data;

  const [undoable, setUndoable] = useState<UndoableAction | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [today] = useState(() => localDateKey(new Date().toISOString()));

  // Vengono dalla lettura salvata, non da uno stato della pagina: sopravvivono al ricaricamento e a un'interruzione.
  const { proposals, aiFields } = doc
    ? proposalsForDocument({ doc, categories, typeCategories, assets, linkedFields, rejections, reminderDates, today })
    : { proposals: [] as Proposal[], aiFields: null };
  const pastEvents = doc && aiFields ? pastEventsOf(aiFields, today) : [];
  const analysisOverview = doc?.contentAnalysis
    ? buildAnalysisOverview(doc.contentAnalysis, doc, categories, reminderDates)
    : null;
  // "Accetta tutto": una sola proposta per tipo (per "campo": per chiave) --- v. handleAcceptAll.
  const acceptAllCandidates = onePerSlot(proposals);

  /** Ogni azione su una proposta passa di qui: esegue, ricarica, lascia pronto l'annullamento. L'id utente serve perché l'audit registra a nome di chi. */
  async function runProposalAction(
    action: (ownerId: string) => Promise<UndoableAction>,
  ): Promise<void> {
    setProposalBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const next = await action(user.id);
      await refresh();
      setUndoable(next);
    } catch (err) {
      setError(errorMessage(err, "Impossibile applicare la proposta."));
    } finally {
      setProposalBusy(false);
    }
  }

  function handleAcceptProposal(proposal: Proposal, value: string) {
    if (!doc) return;
    void runProposalAction(async (ownerId) => {
      const accepted = await acceptProposal(supabase, masterKey, ownerId, doc, proposal, value);
      return {
        message:
          proposal.kind === "event"
            ? `Aggiunta in Scadenze: ${proposal.eventTitle ?? "evento"}, ${formatDate(value)}.`
            : proposal.kind === "asset"
            ? proposal.createAsset
              ? `Bene "${value.trim()}" creato e collegato.`
              : `Collegato a ${assets.find((a) => a.id === value)?.name ?? "un bene"}.`
            : proposal.kind === "expiry"
            ? `Scadenza impostata al ${formatDate(value)}.`
            : proposal.kind === "issuer"
              ? "Emittente impostato."
              : proposal.kind === "field"
                ? `${proposal.fieldLabel ?? "Campo"} impostato.`
                : "Categoria impostata.",
        onUndo: () =>
          void runProposalAction(async (undoOwnerId) => {
            await undoAcceptance(supabase, masterKey, undoOwnerId, doc.id, accepted);
            return { message: "Annullato.", onUndo: () => setUndoable(null) };
          }),
      };
    });
  }

  /** Una sola proposta per tipo (per "campo": per chiave) --- con più candidati della stessa cosa vince la prima, non si sovrascrive in sequenza. */
  function handleAcceptAll(candidates: Proposal[]) {
    if (!doc || candidates.length === 0) return;
    void runProposalAction(async (ownerId) => {
      const accepted: AcceptedProposal[] = [];
      try {
        for (const proposal of candidates) {
          accepted.push(await acceptProposal(supabase, masterKey, ownerId, doc, proposal, proposal.value));
        }
      } catch (err) {
        if (accepted.length > 0) await refresh();
        throw err;
      }
      return {
        message:
          accepted.length === 1 ? "1 informazione aggiunta alla Scheda." : `${accepted.length} informazioni aggiunte alla Scheda.`,
        onUndo: () =>
          void runProposalAction(async (undoOwnerId) => {
            for (const item of [...accepted].reverse()) {
              await undoAcceptance(supabase, masterKey, undoOwnerId, doc.id, item);
            }
            return { message: "Annullato.", onUndo: () => setUndoable(null) };
          }),
      };
    });
  }

  function handleRejectProposal(proposal: Proposal) {
    if (!doc) return;
    void runProposalAction(async (ownerId) => {
      const rejectionId = await rejectProposal(supabase, masterKey, ownerId, doc.id, proposal);
      return {
        message: "Non te lo richiederò più.",
        onUndo: () =>
          void runProposalAction(async (undoOwnerId) => {
            await undoRejection(supabase, undoOwnerId, rejectionId, {
              documentId: doc.id,
              kind: proposal.kind,
              fieldKey: proposal.fieldKey,
            });
            return { message: "Annullato.", onUndo: () => setUndoable(null) };
          }),
      };
    });
  }

  /** Una riga scartata si riprende dal registro: il rifiuto registrato si cancella e la proposta torna da decidere. */
  function handleRestoreRejection(rejection: ProposalRejection) {
    if (!doc) return;
    void runProposalAction(async (ownerId) => {
      await undoRejection(supabase, ownerId, rejection.id, {
        documentId: doc.id,
        kind: rejection.kind,
        fieldKey: rejection.fieldKey,
      });
      return { message: "Proposta ripristinata.", onUndo: () => setUndoable(null) };
    });
  }

  return {
    today,
    undoable,
    proposalBusy,
    proposals,
    pastEvents,
    analysisOverview,
    acceptAllCandidates,
    handleAcceptProposal,
    handleAcceptAll,
    handleRejectProposal,
    handleRestoreRejection,
  };
}
