/**
 * FASE 19 --- quando Hinthial chiede qualcosa, e quando deve tacere.
 *
 * È la funzione più delicata della fase: decide se l'app interrompe
 * l'utente. Sbagliare in eccesso significa un assistente che rifà la
 * stessa domanda dopo che gli è stato detto di no --- il modo più rapido
 * per far smettere qualcuno di leggere le proposte.
 */
import { describe, expect, it } from "vitest";
import { buildProposals } from "@/domain/proposals/build";
import type { Category } from "@/domain/categories/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { ProposalRejection } from "@/domain/proposals/types";

const CATEGORIES: Category[] = [
  { id: "cat-salute", name: "Salute", icon: "🩺" } as Category,
  { id: "cat-assicurazioni", name: "Assicurazioni", icon: "🛡️" } as Category,
  { id: "cat-casa", name: "Casa", icon: "🏠" } as Category,
];

const POLIZZA = [
  "GENERALI ITALIA S.p.A.",
  "Polizza responsabilità civile",
  "Emessa il 14 marzo 2026",
  "Valida fino al 3 giugno 2027",
].join("\n");

function doc(over: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    id: "doc-1",
    filename: "scan_0012.pdf",
    mimeType: "application/pdf",
    size: 1000,
    categoryId: null,
    relatedAssetId: null,
    createdAt: "2026-09-18T10:00:00Z",
    storagePath: "x",
    wrappedDocumentKey: "x",
    expiresAt: null,
    notes: "",
    tags: [],
    transcript: "",
    extractedText: POLIZZA,
    extractedAt: "2026-09-18T10:00:00Z",
    hasThumbnail: false,
    ...over,
  };
}

describe("cosa Hinthial propone", () => {
  it("propone la scadenza che ha letto nel documento", () => {
    const expiry = buildProposals(doc(), CATEGORIES, []).find((p) => p.kind === "expiry");
    expect(expiry?.value).toBe("2027-06-03");
  });

  it("propone una categoria ricavata da quello che c'è scritto dentro", () => {
    // Il nome del file ("scan_0012.pdf") non dice niente: è il caso
    // normale di uno scanner, ed è la ragione per cui la FASE 17 doveva
    // arrivare prima di questa.
    const category = buildProposals(doc(), CATEGORIES, []).find((p) => p.kind === "category");
    expect(category?.value).toBe("cat-assicurazioni");
    expect(category?.source).toBe("Da quello che c'è scritto nel documento");
  });

  it("preferisce il nome del file quando dice qualcosa, e lo dichiara", () => {
    const proposals = buildProposals(
      doc({ filename: "referto-analisi.pdf" }),
      CATEGORIES,
      [],
    );
    const category = proposals.find((p) => p.kind === "category");
    expect(category?.value).toBe("cat-salute");
    expect(category?.source).toContain("Dal nome del file");
  });

  it("ogni proposta porta con sé da dove viene", () => {
    for (const proposal of buildProposals(doc(), CATEGORIES, [])) {
      expect(proposal.source.trim()).not.toBe("");
    }
  });

  it("marca la scadenza calcolata, per non spacciarla per letta", () => {
    const text = "Data del prelievo: 14 marzo 2026\nSi consiglia controllo tra dodici mesi.";
    const expiry = buildProposals(doc({ extractedText: text }), CATEGORIES, []).find(
      (p) => p.kind === "expiry",
    );
    expect(expiry).toMatchObject({ value: "2027-03-14", derived: true });
  });
});

describe("quando Hinthial deve tacere", () => {
  it("non propone una scadenza se il documento ne ha già una", () => {
    // Proporne una vorrebbe dire mettere in discussione una scelta già
    // fatta dall'utente, non aiutarlo.
    const proposals = buildProposals(doc({ expiresAt: "2030-01-01" }), CATEGORIES, []);
    expect(proposals.some((p) => p.kind === "expiry")).toBe(false);
  });

  it("non propone una categoria se il documento ne ha già una", () => {
    const proposals = buildProposals(doc({ categoryId: "cat-casa" }), CATEGORIES, []);
    expect(proposals.some((p) => p.kind === "category")).toBe(false);
  });

  it("non ripropone ciò che è già stato rifiutato", () => {
    const rejections: ProposalRejection[] = [{ id: "r1", kind: "expiry", value: "2027-06-03" }];
    const proposals = buildProposals(doc(), CATEGORIES, rejections);
    expect(proposals.some((p) => p.kind === "expiry")).toBe(false);
  });

  it("il rifiuto vale per quel valore, non per quel tipo di proposta", () => {
    // Rifiutare "3 giugno 2027" non significa aver detto che il
    // documento non scade: se una rilettura ne ricava un'altra, è una
    // proposta nuova e va fatta.
    const rejections: ProposalRejection[] = [{ id: "r1", kind: "expiry", value: "2099-01-01" }];
    const expiry = buildProposals(doc(), CATEGORIES, rejections).find((p) => p.kind === "expiry");
    expect(expiry?.value).toBe("2027-06-03");
  });

  it("su un documento mai letto non propone niente", () => {
    const proposals = buildProposals(
      doc({ extractedText: "", extractedAt: null }),
      CATEGORIES,
      [],
    );
    expect(proposals).toEqual([]);
  });

  it("non propone una categoria che l'utente non ha", () => {
    const proposals = buildProposals(doc(), [CATEGORIES[0]], []);
    expect(proposals.some((p) => p.kind === "category")).toBe(false);
  });

  it("se il campo torna vuoto, la proposta torna", () => {
    // Un documento tornato incompleto è di nuovo un documento su cui
    // vale la pena chiedere.
    const withExpiry = buildProposals(doc({ expiresAt: "2030-01-01" }), CATEGORIES, []);
    const cleared = buildProposals(doc({ expiresAt: null }), CATEGORIES, []);
    expect(withExpiry.some((p) => p.kind === "expiry")).toBe(false);
    expect(cleared.some((p) => p.kind === "expiry")).toBe(true);
  });
});
