/**
 * FASE 21 --- il raggruppamento per nome del file durante un caricamento massivo. È la funzione che decide se propone
 * un fascicolo nuovo, si aggancia a uno esistente, o tace --- quindi è testata soprattutto sui casi in cui deve tacere.
 */
import { describe, expect, it } from "vitest";
import { filenameStem, groupByFilename, type NamedFile } from "@/domain/bulk-import/grouping";
import type { DossierListItem } from "@/domain/dossiers/types";

function file(name: string): NamedFile {
  return { file: new File([""], name) };
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

describe("filenameStem", () => {
  it("toglie estensione, numeri, date e separatori", () => {
    expect(filenameStem("Bolletta_luce-2026-01.pdf")).toBe("bolletta luce");
    expect(filenameStem("bolletta luce 03.2026.PDF")).toBe("bolletta luce");
  });

  it("tace sui nomi generici di uno scanner o di una fotocamera", () => {
    expect(filenameStem("scan_0012.pdf")).toBeNull();
    expect(filenameStem("IMG_3041.jpg")).toBeNull();
    expect(filenameStem("2026-03-14.pdf")).toBeNull();
    expect(filenameStem("fattura.pdf")).toBeNull();
  });
});

describe("propone un fascicolo nuovo", () => {
  it("quando almeno due file hanno lo stesso nome a meno di numeri e date", () => {
    const groups = groupByFilename(
      [file("bolletta-luce-2026-01.pdf"), file("Bolletta luce 2026-02.pdf")],
      [],
      [],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Bolletta luce");
    expect(groups[0].files).toHaveLength(2);
    expect(groups[0].proposedDossierTitle).toBe("Bolletta luce");
    expect(groups[0].existingDossier).toBeNull();
  });

  it("non per un file solo: un documento non è 'un raggruppamento evidente'", () => {
    const groups = groupByFilename([file("bolletta-luce-2026-01.pdf")], [], []);
    expect(groups[0].proposedDossierTitle).toBeNull();
  });

  it("non per nomi generici, anche se uguali", () => {
    const groups = groupByFilename([file("scan_0001.pdf"), file("scan_0002.pdf")], [], []);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.label === null && g.proposedDossierTitle === null)).toBe(true);
  });
});

describe("si aggancia a un fascicolo esistente invece di proporne uno nuovo", () => {
  it("quando un documento già in un fascicolo ha lo stesso nome", () => {
    const casa = dossier({ id: "casa", title: "Bollette di casa" });
    const groups = groupByFilename(
      [file("bolletta-luce-2026-05.pdf")],
      [{ filename: "bolletta luce 2026-04.pdf", dossierIds: ["casa"] }],
      [casa],
    );

    expect(groups[0].existingDossier?.id).toBe("casa");
    expect(groups[0].proposedDossierTitle).toBeNull();
    // Vale anche con un solo file nuovo: non serve un raggruppamento evidente per aggiungersi a una storia già iniziata.
    expect(groups[0].files).toHaveLength(1);
  });

  it("non conta un documento con lo stesso nome ma senza fascicolo", () => {
    const groups = groupByFilename(
      [file("bolletta-luce-01.pdf"), file("bolletta-luce-02.pdf")],
      [{ filename: "bolletta-luce-00.pdf", dossierIds: [] }],
      [],
    );
    expect(groups[0].existingDossier).toBeNull();
    expect(groups[0].proposedDossierTitle).toBe("Bolletta luce");
  });
});

describe("nomi diversi restano gruppi separati", () => {
  it("non mescola due serie diverse in un solo gruppo", () => {
    const groups = groupByFilename(
      [file("luce-01.pdf"), file("bolletta-luce-01.pdf"), file("bolletta-luce-02.pdf"), file("bolletta-gas-01.pdf"), file("bolletta-gas-02.pdf")],
      [],
      [],
    );
    const named = groups.filter((g) => g.label !== null);
    expect(named.map((g) => g.label).sort()).toEqual(["Bolletta gas", "Bolletta luce"]);
    expect(named.every((g) => g.files.length === 2)).toBe(true);
  });
});
