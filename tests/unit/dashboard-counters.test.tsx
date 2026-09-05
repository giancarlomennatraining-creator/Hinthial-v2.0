import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardCounters } from "@/components/dashboard/DashboardCounters";
import type { AIContext } from "@/domain/ai/types";
import type { TrustedContactListItem } from "@/domain/contacts/types";

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

function buildContact(overrides: Partial<TrustedContactListItem> = {}): TrustedContactListItem {
  return {
    id: "contact-1",
    name: "Maria Rossi",
    email: "maria@esempio.it",
    role: "Coniuge",
    status: "active",
    isFriend: false,
    createdAt: "2026-01-01",
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

  it("shows no sub-counter for Contatti when there are no contacts at all", () => {
    render(<DashboardCounters context={buildContext()} />);
    expect(screen.queryByText(/attivi e amici/)).not.toBeInTheDocument();
  });

  it("splits the Contatti sub-counter into two separate tallies --- Attivi and Amici, not their intersection", () => {
    const context = buildContext({
      contacts: [
        buildContact({ id: "c1", status: "active", isFriend: true }),
        // Amico ma non ancora Attivo --- conta per "amici", non per "attivi".
        buildContact({ id: "c2", status: "pending", isFriend: true }),
        // Attivo ma non Amico --- conta per "attivi", non per "amici".
        buildContact({ id: "c3", status: "active", isFriend: false }),
      ],
    });

    render(<DashboardCounters context={context} />);
    expect(screen.getByRole("link", { name: "Contatti: 3 (2 attivi e 2 amici)" })).toBeInTheDocument();
    expect(screen.getByText("2 attivi e 2 amici")).toBeInTheDocument();
  });

  it("shows the sub-counter at 0 e 0 when there are contacts but none qualify yet", () => {
    const context = buildContext({
      contacts: [buildContact({ status: "pending", isFriend: false })],
    });

    render(<DashboardCounters context={context} />);
    expect(screen.getByText("0 attivi e 0 amici")).toBeInTheDocument();
  });
});
