import { describe, expect, it } from "vitest";
import { buildCapsuleStarter, parseStarter, starterHref } from "@/domain/capsules/starter";
import type { AssetListItem } from "@/domain/assets/types";
import type { DocumentSummary } from "@/domain/documents/types";
import type { DossierListItem } from "@/domain/dossiers/types";

const doc = (over: Partial<DocumentSummary> & { id: string }) => ({ filename: `${over.id}.pdf`, dossierIds: [], relatedAssetId: null, ...over }) as DocumentSummary;
const dossier = (id: string, title: string) => ({ id, title }) as DossierListItem;
const asset = (id: string, name: string, legacyNote = "") => ({ id, name, legacyNote, categoryId: null, createdAt: "2026-01-01" }) as AssetListItem;

const DATA = {
  documents: [
    doc({ id: "d1", filename: "polizza.pdf", dossierIds: ["f1"], relatedAssetId: "b1" }),
    doc({ id: "d2", filename: "libretto.pdf", relatedAssetId: "b1" }),
    doc({ id: "d3", filename: "altro.pdf" }),
  ],
  dossiers: [dossier("f1", "Acquisto casa")],
  assets: [asset("b1", "Barca", "Va a Luca. Le chiavi sono dal vicino.")],
};

describe("parseStarter / starterHref", () => {
  it("l'indirizzo porta solo tipo e id, mai testo", () => {
    expect(starterHref("bene", "b1")).toBe("/capsules/new?da=bene:b1");
    expect(parseStarter("bene:b1")).toEqual({ kind: "bene", id: "b1" });
    expect(parseStarter("documento:abc-123")).toEqual({ kind: "documento", id: "abc-123" });
  });

  it("ignora tutto ciò che non riconosce", () => {
    for (const raw of [null, undefined, "", "bene", "bene:", ":b1", "casa:b1", "BENE:b1"]) {
      expect(parseStarter(raw)).toBeNull();
    }
  });
});

describe("buildCapsuleStarter", () => {
  it("da un documento: titolo e allegato, nessuna lettera", () => {
    const s = buildCapsuleStarter({ kind: "documento", id: "d3" }, DATA)!;
    expect(s.title).toBe("altro.pdf");
    expect(s.content).toBe("");
    expect(s.documents.map((d) => d.id)).toEqual(["d3"]);
    expect(s.origin).toBe("il documento altro.pdf");
  });

  it("da un fascicolo: tutti i suoi documenti", () => {
    const s = buildCapsuleStarter({ kind: "fascicolo", id: "f1" }, DATA)!;
    expect(s.title).toBe("Acquisto casa");
    expect(s.documents.map((d) => d.id)).toEqual(["d1"]);
  });

  it("da un bene: la nota diventa la lettera e i documenti del bene gli allegati", () => {
    const s = buildCapsuleStarter({ kind: "bene", id: "b1" }, DATA)!;
    expect(s.title).toBe("Cosa succede a Barca");
    expect(s.content).toBe("Va a Luca. Le chiavi sono dal vicino.");
    expect(s.documents.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("parte sempre con la regola dell'eredità accesa", () => {
    for (const source of [
      { kind: "documento", id: "d1" },
      { kind: "fascicolo", id: "f1" },
      { kind: "bene", id: "b1" },
    ] as const) {
      expect(buildCapsuleStarter(source, DATA)!.openOnLegacy).toBe(true);
    }
  });

  it("se la fonte non esiste più, non c'è nessun punto di partenza", () => {
    expect(buildCapsuleStarter({ kind: "bene", id: "boh" }, DATA)).toBeNull();
    expect(buildCapsuleStarter({ kind: "documento", id: "boh" }, DATA)).toBeNull();
    expect(buildCapsuleStarter({ kind: "fascicolo", id: "boh" }, DATA)).toBeNull();
  });
});
