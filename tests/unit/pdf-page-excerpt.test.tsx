import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisOverviewSection } from "@/components/documents/AnalysisOverviewSection";
import { PdfPageExcerpt } from "@/components/documents/PdfPageExcerpt";
import type { AnalysisOverview } from "@/domain/ai/analysis/overview";
import type { ContentSegment } from "@/domain/extraction/types";

const renderPage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/pdf", () => ({ renderPdfPageWithText: renderPage }));

const RENDERED = {
  image: new Blob(["x"], { type: "image/jpeg" }),
  width: 1200,
  height: 1600,
  transform: [2, 0, 0, -2, 0, 1600],
  items: [{ str: "Valida fino al 3 giugno 2027.", transform: [12, 0, 0, 12, 60, 700], width: 170, height: 12 }],
};

beforeEach(() => {
  renderPage.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:page");
  URL.revokeObjectURL = vi.fn();
});

describe("PdfPageExcerpt", () => {
  it("mostra la pagina originale con la frase evidenziata", async () => {
    renderPage.mockResolvedValue(RENDERED);
    render(
      <PdfPageExcerpt
        loadBytes={async () => new Uint8Array([1])}
        page={2}
        quote="valida fino al 3 giugno 2027."
        fallback={<p>testo</p>}
      />,
    );
    expect(await screen.findByRole("region", { name: "Pagina originale" })).toBeInTheDocument();
    expect(screen.getByAltText("Pagina 2 del documento")).toBeInTheDocument();
    expect(screen.getAllByTestId("page-highlight")).toHaveLength(1);
    expect(renderPage).toHaveBeenCalledWith(expect.any(Uint8Array), 2);
  });

  it("dice che la frase non si può indicare, ma mostra comunque la pagina", async () => {
    renderPage.mockResolvedValue({ ...RENDERED, items: [] });
    render(
      <PdfPageExcerpt loadBytes={async () => new Uint8Array()} page={1} quote="Qualcosa" fallback={<p>testo</p>} />,
    );
    expect(await screen.findByRole("region", { name: "Pagina originale" })).toBeInTheDocument();
    expect(screen.queryByTestId("page-highlight")).toBeNull();
    expect(screen.getByText(/Non riesco a indicare la frase/)).toBeInTheDocument();
  });

  it("ripiega sul testo letto se la pagina non si può disegnare", async () => {
    renderPage.mockResolvedValue(null);
    render(
      <PdfPageExcerpt loadBytes={async () => new Uint8Array()} page={1} quote="Qualcosa" fallback={<p>testo letto</p>} />,
    );
    expect(await screen.findByText("testo letto")).toBeInTheDocument();
  });

  it("ripiega sul testo letto se il file non si scarica", async () => {
    render(
      <PdfPageExcerpt
        loadBytes={() => Promise.reject(new Error("rete"))}
        page={1}
        quote="Qualcosa"
        fallback={<p>testo letto</p>}
      />,
    );
    expect(await screen.findByText("testo letto")).toBeInTheDocument();
  });
});

describe("AnalysisOverviewSection con un PDF", () => {
  const SEGMENTS: ContentSegment[] = [
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
    ],
  };

  it("apre la pagina originale e permette di passare al testo letto e ritorno", async () => {
    renderPage.mockResolvedValue(RENDERED);
    render(
      <AnalysisOverviewSection
        overview={OVERVIEW}
        segments={SEGMENTS}
        text=""
        loadPdfBytes={async () => new Uint8Array([1])}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "pagina 2" }));
    expect(await screen.findByRole("region", { name: "Pagina originale" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mostra il testo letto" }));
    expect(screen.getByRole("region", { name: "Testo letto" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Pagina originale" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mostra la pagina originale" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Pagina originale" })).toBeInTheDocument());
  });

  it("senza i byte del PDF resta il solo testo letto", () => {
    render(<AnalysisOverviewSection overview={OVERVIEW} segments={SEGMENTS} text="" />);
    fireEvent.click(screen.getByRole("button", { name: "pagina 2" }));
    expect(screen.getByRole("region", { name: "Testo letto" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mostra il testo letto" })).toBeNull();
  });
});
