import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VaultHealthWidget } from "@/components/dashboard/VaultHealthWidget";
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

describe("VaultHealthWidget", () => {
  it("renders nothing when the vault has no assets, contacts or documents yet", () => {
    const { container } = render(<VaultHealthWidget context={buildContext()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("flags an asset with no linked documents", () => {
    const context = buildContext({
      assets: [{ id: "asset-barca", name: "Barca", categoryId: null, createdAt: "2026-01-01" }],
    });
    render(<VaultHealthWidget context={context} />);
    expect(screen.getByText("1 di 1 asset non hanno ancora contenuti collegati.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Barca" })).toHaveAttribute("href", "/assets");
  });

  it("reports every asset covered when each has at least one linked document", () => {
    const context = buildContext({
      assets: [{ id: "asset-auto", name: "Auto Panda", categoryId: null, createdAt: "2026-01-01" }],
      documents: [
        {
          id: "doc-1",
          filename: "libretto.pdf",
          mimeType: "application/pdf",
          size: 100,
          categoryId: null,
          relatedAssetId: "asset-auto",
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
    render(<VaultHealthWidget context={context} />);
    expect(screen.getByText("Tutti i 1 asset hanno almeno un contenuto collegato.")).toBeInTheDocument();
  });

  it("flags an active trusted contact not referenced by any capsule, but not a revoked one", () => {
    const context = buildContext({
      contacts: [
        { id: "contact-1", name: "Maria Rossi", email: "maria@esempio.it", role: "Coniuge", status: "active", isFriend: false, createdAt: "2026-01-01" },
        { id: "contact-2", name: "Ex Avvocato", email: "ex@esempio.it", role: "Avvocato", status: "revoked", isFriend: false, createdAt: "2026-01-01" },
      ],
    });
    render(<VaultHealthWidget context={context} />);
    expect(
      screen.getByText("1 di 1 contatti fiduciari non sono ancora collegati a nessuna capsula."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Maria Rossi" })).toHaveAttribute("href", "/contacts");
    expect(screen.queryByText(/Ex Avvocato/)).not.toBeInTheDocument();
  });

  it("counts documents with a tracked expiry date", () => {
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
        {
          id: "doc-2",
          filename: "foto.jpg",
          mimeType: "image/jpeg",
          size: 100,
          categoryId: null,
          relatedAssetId: null,
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
    render(<VaultHealthWidget context={context} />);
    expect(screen.getByText("1 di 2 contenuti hanno una scadenza tracciata.")).toBeInTheDocument();
  });
});
