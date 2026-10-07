import type { DossierPhases } from "@/domain/dossiers/phases";

/**
 * Condividere un fascicolo con un professionista con un link protetto (v. migrazione dossier_shares). Il dispositivo di chi
 * condivide ricifra i documenti scelti con una chiave nuova, che sta solo nel link dopo il simbolo #: il server consegna
 * byte cifrati e non può leggerli. Qui la parte pura: opzioni, limiti, indice, chiave nel link, stato, accessi.
 */

export const SHARE_EXPIRY_OPTIONS = [
  { id: "24h", label: "24 ore", hours: 24 },
  { id: "7d", label: "7 giorni", hours: 24 * 7 },
  { id: "30d", label: "30 giorni", hours: 24 * 30 },
] as const;
export type ShareExpiryId = (typeof SHARE_EXPIRY_OPTIONS)[number]["id"];

/** Suggerimenti per "Con chi": solo un'etichetta per riconoscere il link, non cambia cosa si vede. */
export const SHARE_AUDIENCES = ["Notaio", "Medico", "Commercialista", "Avvocato"] as const;

export const MAX_SHARE_DOCUMENTS = 40;
export const MAX_SHARE_BYTES = 100 * 1024 * 1024;
export const MAX_SHARE_LABEL_LENGTH = 60;

export function expiresAtFor(expiryId: ShareExpiryId, now: Date): string {
  const option = SHARE_EXPIRY_OPTIONS.find((o) => o.id === expiryId) ?? SHARE_EXPIRY_OPTIONS[1];
  return new Date(now.getTime() + option.hours * 3_600_000).toISOString();
}

/** Troppi documenti o troppo peso: la ricifratura avviene sul dispositivo, e un limite la tiene sostenibile. */
export function validateShareSelection(documents: { size: number }[]): string | null {
  if (documents.length === 0) return "Scegli almeno un documento da condividere.";
  if (documents.length > MAX_SHARE_DOCUMENTS) {
    return `Puoi condividere al massimo ${MAX_SHARE_DOCUMENTS} documenti alla volta.`;
  }
  const total = documents.reduce((sum, d) => sum + d.size, 0);
  if (total > MAX_SHARE_BYTES) {
    return `I documenti scelti pesano troppo: al massimo ${MAX_SHARE_BYTES / (1024 * 1024)} MB in tutto.`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// L'indice cifrato: ciò che chi riceve il link vede, oltre ai documenti.
// ---------------------------------------------------------------------------------------------------------------

export interface ShareManifestDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** ISO: quando è entrato in Hinthial. */
  createdAt: string;
}

export interface ShareManifest {
  v: 1;
  title: string;
  description: string;
  /** Chi ha condiviso (nome e cognome del profilo), perché chi riceve sappia da chi viene. */
  sharedBy: string;
  sharedAt: string;
  phase: DossierPhases | null;
  summary: string | null;
  documents: ShareManifestDocument[];
}

export function buildManifest(input: Omit<ShareManifest, "v">): ShareManifest {
  return { v: 1, ...input };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

/** Dal JSON decifrato: un indice di forma inattesa non si mostra a metà, vale "link non valido". */
export function parseManifest(json: string): ShareManifest | null {
  try {
    const value = JSON.parse(json) as Record<string, unknown> | null;
    if (!value || typeof value !== "object" || value.v !== 1) return null;
    const { title, description, sharedBy, sharedAt, phase, summary, documents } = value;
    if (!isString(title) || !isString(description) || !isString(sharedBy) || !isString(sharedAt) || !Array.isArray(documents)) return null;

    const parsedDocuments: ShareManifestDocument[] = [];
    for (const raw of documents) {
      if (!raw || typeof raw !== "object") return null;
      const { id, name, mimeType, size, createdAt } = raw as Record<string, unknown>;
      if (!isString(id) || !isString(name) || !isString(mimeType) || typeof size !== "number" || !isString(createdAt)) return null;
      parsedDocuments.push({ id, name, mimeType, size, createdAt });
    }

    let parsedPhase: DossierPhases | null = null;
    if (phase && typeof phase === "object") {
      const { names, current } = phase as { names?: unknown; current?: unknown };
      if (Array.isArray(names) && names.every(isString) && typeof current === "number") parsedPhase = { names, current };
    }

    return {
      v: 1,
      title,
      description,
      sharedBy,
      sharedAt,
      phase: parsedPhase,
      summary: isString(summary) && summary.trim() ? summary : null,
      documents: parsedDocuments,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Il link: l'identificativo nel percorso, la chiave dopo il #.
// ---------------------------------------------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isShareId(value: string): boolean {
  return UUID.test(value);
}

/** Base64 senza simboli che disturbano un indirizzo (+, /, =): la chiave sta in un link e si copia e incolla. */
export function keyToFragment(raw: Uint8Array): string {
  let binary = "";
  for (const byte of raw) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** La chiave AES-256 dal frammento del link; qualunque altra cosa (mancante, troncata, di altra lunghezza) → null. */
export function fragmentToKeyBytes(fragment: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(fragment)) return null;
  try {
    const binary = atob(fragment.replace(/-/g, "+").replace(/_/g, "/") + "=");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}

export function shareUrl(origin: string, shareId: string, fragment: string): string {
  return `${origin}/c/${shareId}#${fragment}`;
}

/** `location.hash` ("#abc…") senza il cancelletto. */
export function fragmentFromHash(hash: string): string {
  return hash.startsWith("#") ? hash.slice(1) : hash;
}

// ---------------------------------------------------------------------------------------------------------------
// Stato e accessi.
// ---------------------------------------------------------------------------------------------------------------

export type ShareStatus = "active" | "expired" | "revoked";

export function shareStatus(share: { expiresAt: string; revokedAt: string | null }, now: Date): ShareStatus {
  if (share.revokedAt) return "revoked";
  return new Date(share.expiresAt).getTime() <= now.getTime() ? "expired" : "active";
}

export interface ShareAccess {
  kind: "open" | "document";
  documentId: string | null;
  accessedAt: string;
}

export interface AccessSummary {
  /** Quante volte è stato aperto il link. */
  opens: number;
  /** Quanti documenti diversi sono stati aperti. */
  documentsSeen: number;
  lastAt: string | null;
}

export function summarizeAccesses(accesses: ShareAccess[]): AccessSummary {
  const documents = new Set<string>();
  let opens = 0;
  let lastAt: string | null = null;
  for (const access of accesses) {
    if (access.kind === "open") opens += 1;
    else if (access.documentId) documents.add(access.documentId);
    if (lastAt === null || access.accessedAt > lastAt) lastAt = access.accessedAt;
  }
  return { opens, documentsSeen: documents.size, lastAt };
}

/** Un'email già scritta per chi riceve il link. */
export function mailtoUrl(input: { label: string; title: string; url: string; expiresAt: string }): string {
  const expires = new Date(input.expiresAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const subject = `Fascicolo: ${input.title}`;
  const body = [
    input.label ? `Buongiorno ${input.label},` : "Buongiorno,",
    "",
    `ti condivido il fascicolo "${input.title}" con un link protetto, valido fino al ${expires}:`,
    "",
    input.url,
    "",
    "Il link va aperto per intero, compresa l'ultima parte dopo il simbolo #: senza, i documenti non si leggono.",
  ].join("\n");
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
