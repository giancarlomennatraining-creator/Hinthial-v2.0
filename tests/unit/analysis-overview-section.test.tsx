import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisOverviewSection } from "@/components/documents/AnalysisOverviewSection";
import type { AnalysisOverview } from "@/domain/ai/analysis/overview";
import type { ContentSegment } from "@/domain/extraction/types";

const SEGMENTS: ContentSegment[] = [
  { id: "p1", kind: "page", index: 1, text: "Polizza n. IT-4471 di Generali." },
  { id: "p2", kind: "page", index: 2, text: "Condizioni.\nValida fino al 3 giugno 2027.\nFine." },
];

const OVERVIEW: AnalysisOverview = {
  typeLabel: "Polizza assicurativa",
  typeRecognized: true,
  coverage: { read: 1, total: 1, truncated: false },
  facts: [
    {
      id: "expiry-0",
      kind: "expiry",
      label: "Scadenza",
      value: "2027-06-03",
      valueType: "date",
      quote: "Valida fino al 3 giugno 2027.",
      provenance: { segmentId: "p2", page: 2 },
      adopted: false,
    },
    {
      id: "issuer-0",
      kind: "issuer",
      label: "Emittente",
      value: "Generali",
      valueType: "text",
      quote: "di Generali",
      provenance: { segmentId: "p9", page: 9 },
      adopted: true,
    },
  ],
};

describe("AnalysisOverviewSection", () => {
  it("mostra il tipo, i dati e l'origine di ciascuno", () => {
    render(<AnalysisOverviewSection overview={OVERVIEW} segments={SEGMENTS} text="" />);
    expect(screen.getByText("Polizza assicurativa")).toBeInTheDocument();
    expect(screen.getByText("Letto da Hinthia")).toBeInTheDocument();
    expect(screen.getByText("Nella Scheda")).toBeInTheDocument();
  });

  it("la pagina d'origine apre il testo letto con la frase evidenziata, e si richiude", () => {
    render(<AnalysisOverviewSection overview={OVERVIEW} segments={SEGMENTS} text="" />);
    expect(screen.queryByRole("region", { name: "Testo letto" })).toBeNull();

    const open = screen.getByRole("button", { name: "pagina 2" });
    fireEvent.click(open);
    const region = screen.getByRole("region", { name: "Testo letto" });
    expect(within(region).getByText("Valida fino al 3 giugno 2027.").tagName).toBe("MARK");
    expect(region).toHaveTextContent("Condizioni.");

    fireEvent.click(open);
    expect(screen.queryByRole("region", { name: "Testo letto" })).toBeNull();
  });

  it("senza il testo di quella pagina (cambiato dopo la lettura) la provenienza resta una semplice etichetta", () => {
    render(<AnalysisOverviewSection overview={OVERVIEW} segments={SEGMENTS} text="" />);
    expect(screen.getByText("pagina 9")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pagina 9" })).toBeNull();
  });
});
