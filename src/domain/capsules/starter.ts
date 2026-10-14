import type { AssetListItem } from "@/domain/assets/types";
import type { DocumentSummary } from "@/domain/documents/types";
import type { DossierListItem } from "@/domain/dossiers/types";
import type { FriendListItem } from "@/domain/friends/types";

/**
 * "Fallo arrivare a…": da un documento, un fascicolo o un bene si parte da una capsula già avviata, invece che da un foglio
 * bianco; da una persona si parte con lei già scelta come destinataria. Chi la scrive deve solo scegliere il resto. Il punto di partenza viaggia nell'indirizzo come tipo e id
 * (`/capsules/new?da=bene:<id>`), mai come testo: titoli e note sono cifrati e non devono finire nella cronologia del
 * browser, quindi il modulo li ricostruisce da sé una volta sbloccato. Puro: nessuna rete, nessun database.
 */

export type StarterKind = "documento" | "fascicolo" | "bene" | "persona";

export interface StarterSource {
  kind: StarterKind;
  id: string;
}

const KINDS: StarterKind[] = ["documento", "fascicolo", "bene", "persona"];

/** L'indirizzo del modulo di nuova capsula, già avviato da questa fonte. */
export function starterHref(kind: StarterKind, id: string): string {
  return `/capsules/new?da=${kind}:${id}`;
}

/** Legge il parametro `da` dell'indirizzo; qualunque cosa non riconosciuta è "nessun punto di partenza". */
export function parseStarter(raw: string | null | undefined): StarterSource | null {
  if (!raw) return null;
  const separator = raw.indexOf(":");
  if (separator < 0) return null;
  const kind = raw.slice(0, separator) as StarterKind;
  const id = raw.slice(separator + 1);
  if (!KINDS.includes(kind) || id.length === 0) return null;
  return { kind, id };
}

export interface CapsuleStarter {
  /** Da dove nasce, in parole: "il documento polizza.pdf". */
  origin: string;
  title: string;
  /** Il testo della lettera (vuoto se la fonte non ne ha). */
  content: string;
  /** Gli elementi d'Archivio da collegare come allegati. */
  documents: DocumentSummary[];
  /** Il destinatario già scelto (vuoto se la fonte non ne ha uno). */
  recipients: FriendListItem[];
  /** "Fallo arrivare" vuol dire farlo arrivare anche se non ci sei: per documenti, fascicoli e beni la regola dell'eredità parte accesa. Scrivere a una persona non la accende da sola. */
  openOnLegacy: boolean;
}

interface StarterData {
  documents: DocumentSummary[];
  dossiers: DossierListItem[];
  assets: AssetListItem[];
  friends: FriendListItem[];
}

/** La capsula avviata da una fonte, o null se la fonte non esiste più (eliminata nel frattempo). */
export function buildCapsuleStarter(source: StarterSource, data: StarterData): CapsuleStarter | null {
  switch (source.kind) {
    case "documento": {
      const doc = data.documents.find((d) => d.id === source.id);
      if (!doc) return null;
      return {
        origin: `il documento ${doc.filename}`,
        title: doc.filename,
        content: "",
        documents: [doc],
        recipients: [],
        openOnLegacy: true,
      };
    }
    case "fascicolo": {
      const dossier = data.dossiers.find((d) => d.id === source.id);
      if (!dossier) return null;
      return {
        origin: `il fascicolo ${dossier.title}`,
        title: dossier.title,
        content: "",
        documents: data.documents.filter((d) => d.dossierIds.includes(dossier.id)),
        recipients: [],
        openOnLegacy: true,
      };
    }
    case "bene": {
      const asset = data.assets.find((a) => a.id === source.id);
      if (!asset) return null;
      return {
        origin: `il bene ${asset.name}`,
        title: `Cosa succede a ${asset.name}`,
        // La nota "cosa succede a questo bene" diventa la lettera: è già quello che si vuole dire a chi riceve.
        content: asset.legacyNote,
        documents: data.documents.filter((d) => d.relatedAssetId === asset.id),
        recipients: [],
        openOnLegacy: true,
      };
    }
    case "persona": {
      // Solo un amico attivo può ricevere una capsula (come nel selettore dei destinatari).
      const friend = data.friends.find((f) => f.id === source.id && f.status === "active");
      if (!friend) return null;
      return {
        origin: friend.name,
        // Come nella rubrica: il nome salvato, altrimenti la prima parola del nome visualizzato (gli amici più vecchi non l'hanno).
        title: `Per ${friend.firstName.trim() || friend.name.trim().split(/\s+/)[0] || friend.name}`,
        content: "",
        documents: [],
        recipients: [friend],
        openOnLegacy: false,
      };
    }
  }
}
