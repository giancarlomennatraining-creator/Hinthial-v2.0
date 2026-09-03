import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WatchlistWidget } from "@/components/dashboard/WatchlistWidget";
import type { AIContext } from "@/domain/ai/types";

function buildContext(overrides: Partial<AIContext> = {}): AIContext {
  return {
    categories: [],
    assets: [],
    documents: [],
    reminders: [],
    contacts: [],
    capsules: [],
    ...overrides,
  };
}

describe("WatchlistWidget", () => {
  it("renders nothing when there are no suggestions and the vault is empty", () => {
    const { container } = render(<WatchlistWidget context={buildContext()} suggestions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a single \"Da tenere d'occhio\" heading with both a suggestion and an unrelated vault-health line together", () => {
    const context = buildContext({
      assets: [{ id: "asset-barca", name: "Barca", categoryId: null, createdAt: "2026-01-01" }],
      documents: [
        {
          id: "doc-1",
          filename: "libretto.pdf",
          mimeType: "application/pdf",
          size: 100,
          categoryId: null,
          relatedAssetId: "asset-barca",
          createdAt: "2026-01-01",
          storagePath: "",
          wrappedDocumentKey: "",
          expiresAt: null,
          notes: "",
          tags: [],
          transcript: "",
        },
      ],
    });
    const suggestions = [
      {
        text: "Hai 1 scadenza scaduta: Bollo auto.",
        sources: [{ kind: "reminder" as const, id: "rem-1", label: "Bollo auto", href: "/reminders" }],
      },
    ];

    render(<WatchlistWidget context={context} suggestions={suggestions} />);

    // Una sola intestazione, non due card distinte.
    expect(screen.getAllByText("Da tenere d'occhio")).toHaveLength(1);

    expect(screen.getByText("Hai 1 scadenza scaduta: Bollo auto.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bollo auto" })).toHaveAttribute("href", "/reminders");

    // L'asset è collegato: la riga di salute del vault è quella positiva.
    expect(screen.getByText("Tutti i 1 asset hanno almeno un contenuto collegato.")).toBeInTheDocument();
  });

  it("does not repeat an asset already flagged by a suggestion --- suggest() covers assets without documents itself", () => {
    const context = buildContext({
      assets: [{ id: "asset-barca", name: "Barca", categoryId: null, createdAt: "2026-01-01" }],
    });
    // Come mockAIProvider.suggest() produrrebbe per lo stesso asset scollegato.
    const suggestions = [
      {
        text: "Questo asset non ha ancora documenti collegati: Barca.",
        sources: [{ kind: "asset" as const, id: "asset-barca", label: "Barca", href: "/assets" }],
      },
    ];

    render(<WatchlistWidget context={context} suggestions={suggestions} />);

    // "Barca" compare una volta sola (nel suggerimento), non anche in una riga di salute del vault duplicata.
    expect(screen.getAllByRole("link", { name: "Barca" })).toHaveLength(1);
    expect(screen.queryByText(/asset non hanno ancora contenuti collegati/)).not.toBeInTheDocument();
  });

  it("shows vault-health content even with no suggestions at all", () => {
    const context = buildContext({
      documents: [
        {
          id: "doc-1",
          filename: "polizza.pdf",
          mimeType: "application/pdf",
          size: 100,
          categoryId: null,
          relatedAssetId: null,
          createdAt: "2026-01-01",
          storagePath: "",
          wrappedDocumentKey: "",
          expiresAt: "2027-01-01",
          notes: "",
          tags: [],
          transcript: "",
        },
      ],
    });

    render(<WatchlistWidget context={context} suggestions={[]} />);
    expect(screen.getByText("1 di 1 contenuto ha una scadenza tracciata.")).toBeInTheDocument();
  });
});
