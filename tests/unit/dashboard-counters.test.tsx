import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardCounters } from "@/components/dashboard/DashboardCounters";
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

describe("DashboardCounters", () => {
  it("shows a zero count and the right link for each empty section", () => {
    render(<DashboardCounters context={buildContext()} />);

    expect(screen.getByRole("link", { name: "Archivio: 0" })).toHaveAttribute("href", "/archive");
    expect(screen.getByRole("link", { name: "Asset: 0" })).toHaveAttribute("href", "/assets");
    expect(screen.getByRole("link", { name: "Contatti: 0" })).toHaveAttribute("href", "/contacts");
    expect(screen.getByRole("link", { name: "Capsule: 0" })).toHaveAttribute("href", "/capsules");
    expect(screen.getByRole("link", { name: "Categorie: 0" })).toHaveAttribute("href", "/settings");
  });

  it("reflects the actual count per section", () => {
    const context = buildContext({
      categories: [{ id: "c1", name: "Casa", icon: "🏠" }],
      documents: [
        {
          id: "d1",
          filename: "polizza.pdf",
          mimeType: "application/pdf",
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

    render(<DashboardCounters context={context} />);
    expect(screen.getByRole("link", { name: "Archivio: 1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Categorie: 1" })).toBeInTheDocument();
  });
});
