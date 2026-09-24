/**
 * FASE 21 --- il raggruppamento per emittente durante un caricamento
 * massivo. È la funzione che decide se propone un fascicolo nuovo, si
 * aggancia a uno esistente, o tace --- quindi è testata soprattutto sui
 * casi in cui deve tacere, come già fatto per buildProposals (FASE 19).
 */
import { describe, expect, it } from "vitest";
import { groupByIssuer, type ReadFile } from "@/domain/bulk-import/grouping";
import type { DocumentListItem } from "@/domain/documents/types";
import type { DossierListItem } from "@/domain/dossiers/types";

function file(name: string, text: string | null): ReadFile {
  return { file: new File([""], name), text };
}

function doc(over: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    id: "doc-1",
    filename: "doc.pdf",
    mimeType: "application/pdf",
    size: 100,
    categoryId: null,
    relatedAssetId: null,
    dossierIds: [],
    createdAt: "2026-01-01T00:00:00Z",
    storagePath: "x",
    wrappedDocumentKey: "x",
    expiresAt: null,
    notes: "",
    tags: [],
    transcript: "",
    extractedText: "",
    extractedAt: "2026-01-01T00:00:00Z",
    hasThumbnail: false,
    issuer: "",
    deletedAt: null,
    purgeAt: null,
    ...over,
  };
}

function dossier(over: Partial<DossierListItem> = {}): DossierListItem {
  return {
    id: "dossier-1",
    title: "Fascicolo",
    description: "",
    status: "open",
    createdAt: "2026-01-01T00:00:00Z",
    closedAt: null,
    ...over,
  };
}

const ENEL = "ENEL ENERGIA S.p.A.";
const BOLLETTA = (num: string) => `${ENEL}\nBolletta luce\nTotale € ${num}`;

describe("propone un fascicolo nuovo", () => {
  it("quando almeno due file condividono l'emittente", () => {
    const groups = groupByIssuer(
      [file("a.pdf", BOLLETTA("50,00")), file("b.pdf", BOLLETTA("55,00"))],
      [],
      [],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].issuer).toBe(ENEL);
    expect(groups[0].files).toHaveLength(2);
    expect(groups[0].proposedDossierTitle).toBe(ENEL);
    expect(groups[0].existingDossier).toBeNull();
  });

  it("non per un file solo: un documento non è 'un raggruppamento evidente'", () => {
    const groups = groupByIssuer([file("a.pdf", BOLLETTA("50,00"))], [], []);
    expect(groups[0].proposedDossierTitle).toBeNull();
  });

  it("non per file senza un emittente riconoscibile", () => {
    const groups = groupByIssuer(
      [file("a.pdf", "testo qualunque"), file("b.pdf", "altro testo qualunque")],
      [],
      [],
    );
    expect(groups.every((g) => g.issuer === null)).toBe(true);
    expect(groups.every((g) => g.proposedDossierTitle === null)).toBe(true);
  });

  it("non quando i file hanno testo nullo (tipo non leggibile)", () => {
    const groups = groupByIssuer([file("a.mp3", null), file("b.mp3", null)], [], []);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.issuer === null)).toBe(true);
  });
});

describe("si aggancia a un fascicolo esistente invece di proporne uno nuovo", () => {
  it("quando un documento già in un fascicolo condivide l'emittente", () => {
    const casa = dossier({ id: "casa", title: "Bollette di casa" });
    const existingDoc = doc({ id: "vecchia-bolletta", dossierIds: ["casa"], extractedText: BOLLETTA("40,00") });

    const groups = groupByIssuer([file("nuova.pdf", BOLLETTA("60,00"))], [existingDoc], [casa]);

    expect(groups[0].existingDossier?.id).toBe("casa");
    expect(groups[0].proposedDossierTitle).toBeNull();
    // Vale anche con un solo file nuovo: non serve un raggruppamento
    // evidente per aggiungersi a una storia già iniziata.
    expect(groups[0].files).toHaveLength(1);
  });

  it("non conta un documento con lo stesso emittente ma senza fascicolo", () => {
    const existingDoc = doc({ id: "altra-bolletta", dossierIds: [], extractedText: BOLLETTA("40,00") });
    const groups = groupByIssuer(
      [file("a.pdf", BOLLETTA("50,00")), file("b.pdf", BOLLETTA("55,00"))],
      [existingDoc],
      [],
    );
    expect(groups[0].existingDossier).toBeNull();
    // E allora, con due file nel lotto, propone comunque un fascicolo nuovo.
    expect(groups[0].proposedDossierTitle).toBe(ENEL);
  });
});

describe("emittenti diversi restano gruppi separati", () => {
  it("non mescola due fornitori diversi in un solo gruppo", () => {
    const gas = "ITALGAS RETI S.p.A.";
    const groups = groupByIssuer(
      [
        file("luce1.pdf", BOLLETTA("50,00")),
        file("luce2.pdf", BOLLETTA("52,00")),
        file("gas1.pdf", `${gas}\nBolletta gas\nTotale € 30,00`),
        file("gas2.pdf", `${gas}\nBolletta gas\nTotale € 32,00`),
      ],
      [],
      [],
    );
    expect(groups).toHaveLength(2);
    const issuers = groups.map((g) => g.issuer).sort();
    expect(issuers).toEqual([gas, ENEL].sort());
  });
});
