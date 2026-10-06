import type { Proposal, ProposalRejection } from "@/domain/proposals/types";

/**
 * Collegare un documento al suo bene senza che l'utente compili nulla: il bene "impara" dai documenti che ha già
 * collegati. Se un documento ha la stessa targa (o lo stesso numero di polizza) di un documento già collegato a un
 * bene, si propone quel bene. Solo uguaglianza esatta, e solo se il bene è uno: un collegamento sbagliato costa
 * più di uno mancante. Puro e senza rete: il confronto avviene sul dispositivo, su campi già decifrati.
 */

/**
 * I campi che identificano il bene e non il documento: la targa è dell'auto, il numero di polizza resta lo stesso a
 * ogni rinnovo, il codice di fornitura è della casa o dell'utenza. Un numero di fattura o di verbale identifica
 * quel documento e non va mai usato per collegare.
 */
const LINKING_FIELDS: Record<string, string> = {
  targa: "Stessa targa",
  numero_polizza: "Stesso numero di polizza",
  numero_contratto: "Stesso numero di contratto",
  codice_fornitura: "Stesso codice di fornitura",
};

/** Sotto questa lunghezza un identificativo non distingue nulla ("1", "A2"): meglio tacere. */
const MIN_IDENTIFIER_LENGTH = 4;

/** Maiuscole e solo lettere/cifre: "ab 123-cd" e "AB123CD" sono la stessa targa. */
export function normalizeIdentifier(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Un documento già collegato a un bene, con i suoi campi salvati (già decifrati). */
export interface LinkedDocumentFields {
  filename: string;
  assetId: string;
  fields: Record<string, string>;
}

/** Un identificativo del documento da collegare: salvato nella Scheda o letto da Hinthia. */
export interface OwnIdentifier {
  key: string;
  value: string;
}

export function buildAssetProposal(input: {
  doc: { relatedAssetId: string | null; structuredFields: Record<string, string> };
  /** I campi letti da Hinthia e non ancora accettati: contano come quelli già salvati. */
  readFields: OwnIdentifier[];
  linked: LinkedDocumentFields[];
  assets: { id: string; name: string }[];
  rejections: ProposalRejection[];
}): Proposal | null {
  const { doc, readFields, linked, assets, rejections } = input;
  if (doc.relatedAssetId) return null;

  // Prima ciò che l'utente ha già confermato nella Scheda, poi ciò che Hinthia ha letto.
  const own: OwnIdentifier[] = [
    ...Object.entries(doc.structuredFields).map(([key, value]) => ({ key, value })),
    ...readFields,
  ].filter((identifier) => identifier.key in LINKING_FIELDS);

  const matches: { assetId: string; own: OwnIdentifier; filename: string }[] = [];
  for (const identifier of own) {
    const wanted = normalizeIdentifier(identifier.value);
    if (wanted.length < MIN_IDENTIFIER_LENGTH) continue;
    for (const other of linked) {
      const theirs = other.fields[identifier.key];
      if (theirs && normalizeIdentifier(theirs) === wanted) {
        matches.push({ assetId: other.assetId, own: identifier, filename: other.filename });
      }
    }
  }

  // Un solo bene, o niente: se lo stesso identificativo porta a due beni diversi non si sceglie al posto dell'utente.
  const assetIds = new Set(matches.map((m) => m.assetId));
  if (assetIds.size !== 1) return null;

  const [match] = matches;
  const asset = assets.find((a) => a.id === match.assetId);
  if (!asset) return null;
  if (rejections.some((r) => r.kind === "asset" && r.value === asset.id)) return null;

  return {
    kind: "asset",
    value: asset.id,
    source: `${LINKING_FIELDS[match.own.key]} (${match.own.value}) di "${match.filename}", già collegato a ${asset.name}.`,
  };
}

/** Oltre questa lunghezza un "oggetto assicurato" è una frase, non il nome di un bene. */
const MAX_ASSET_NAME_LENGTH = 60;

/**
 * Il documento parla di un bene che ancora non c'è? Il nome si ricava dai campi già letti o confermati, senza altre
 * letture: la targa (con il modello del veicolo se la polizza lo dice), l'oggetto assicurato di una polizza, il codice
 * di fornitura di un'utenza. Se un bene con lo stesso nome esiste già, si propone di collegarlo invece di crearne un
 * doppione. Il nome è una proposta, modificabile prima di accettare.
 */
export function buildNewAssetProposal(input: {
  doc: { relatedAssetId: string | null; structuredFields: Record<string, string> };
  readFields: OwnIdentifier[];
  assets: { id: string; name: string }[];
  rejections: ProposalRejection[];
}): Proposal | null {
  const { doc, readFields, assets, rejections } = input;
  if (doc.relatedAssetId) return null;

  // Ciò che è già nella Scheda vince su ciò che Hinthia ha letto.
  const values: Record<string, string> = {};
  for (const { key, value } of [...readFields, ...Object.entries(doc.structuredFields).map(([key, value]) => ({ key, value }))]) {
    if (value.trim()) values[key] = value.trim();
  }

  const object = values.oggetto_assicurato && values.oggetto_assicurato.length <= MAX_ASSET_NAME_LENGTH ? values.oggetto_assicurato : null;
  const plate = values.targa && normalizeIdentifier(values.targa).length >= MIN_IDENTIFIER_LENGTH ? values.targa.toUpperCase() : null;
  const supply =
    values.codice_fornitura && normalizeIdentifier(values.codice_fornitura).length >= MIN_IDENTIFIER_LENGTH
      ? values.codice_fornitura
      : null;

  let name: string | null = null;
  let from = "";
  if (plate) {
    name = object ? `${object} (${plate})` : `Veicolo ${plate}`;
    from = object ? `oggetto assicurato "${object}" e targa ${plate}` : `targa ${plate}`;
  } else if (object) {
    name = object;
    from = `oggetto assicurato "${object}"`;
  } else if (supply) {
    name = `Utenza ${supply}`;
    from = `codice di fornitura ${supply}`;
  }
  if (!name) return null;

  const wanted = normalizeIdentifier(name);
  const existing = assets.find((a) => normalizeIdentifier(a.name) === wanted);
  if (existing) {
    if (rejections.some((r) => r.kind === "asset" && r.value === existing.id)) return null;
    return { kind: "asset", value: existing.id, source: `Dal documento: ${from}. Hai già un bene con questo nome.` };
  }

  if (rejections.some((r) => r.kind === "asset" && r.value === name)) return null;
  return { kind: "asset", value: name, createAsset: true, source: `Dal documento: ${from}. Non hai ancora un bene così.` };
}
