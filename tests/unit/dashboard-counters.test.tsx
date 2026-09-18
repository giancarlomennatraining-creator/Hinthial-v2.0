import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardCounters } from "@/components/dashboard/DashboardCounters";
import type { AIContext } from "@/domain/ai/types";
import type { FriendListItem } from "@/domain/friends/types";

function buildContext(overrides: Partial<AIContext> = {}): AIContext {
  return {
    categories: [],
    assets: [],
    documents: [],
    reminders: [],
    friends: [],
    capsules: [],
    ...overrides,
  };
}

function buildFriend(overrides: Partial<FriendListItem> = {}): FriendListItem {
  return {
    id: "friend-1",
    name: "Maria Rossi",
    email: "maria@esempio.it", firstName: "", lastName: "", avatarPath: null, avatarUrl: null,
    role: "Coniuge",
    status: "active",
    isFriend: false,
    isGuardian: false,
    linkedUserId: null,
    createdAt: "2026-01-01",
    ...overrides,
  };
}

describe("DashboardCounters", () => {
  it("shows a zero count and the right link for each empty section", () => {
    render(<DashboardCounters context={buildContext()} />);

    expect(screen.getByRole("link", { name: "Archivio: 0" })).toHaveAttribute("href", "/archive");
    expect(screen.getByRole("link", { name: "Beni: 0" })).toHaveAttribute("href", "/assets");
    expect(screen.getByRole("link", { name: "Amici: 0" })).toHaveAttribute("href", "/friends");
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
          extractedText: "",
        },
      ],
    });

    render(<DashboardCounters context={context} />);
    expect(screen.getByRole("link", { name: "Archivio: 1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Categorie: 1" })).toBeInTheDocument();
  });

  it("shows no sub-counter for Amici when there are no friends at all", () => {
    render(<DashboardCounters context={buildContext()} />);
    expect(screen.queryByText(/attivi e guardiani/)).not.toBeInTheDocument();
  });

  it("splits the Amici sub-counter into two separate tallies --- Attivi and Guardiani, not their intersection", () => {
    const context = buildContext({
      friends: [
        buildFriend({ id: "f1", status: "active", isGuardian: true }),
        // Guardiano ma revocato --- conta per "guardiani", non per "attivi".
        buildFriend({ id: "f2", status: "revoked", isGuardian: true }),
        // Attivo ma non Guardiano --- conta per "attivi", non per "guardiani".
        buildFriend({ id: "f3", status: "active", isGuardian: false }),
      ],
    });

    render(<DashboardCounters context={context} />);
    expect(screen.getByRole("link", { name: "Amici: 3 (2 attivi e 2 guardiani)" })).toBeInTheDocument();
    expect(screen.getByText("2 attivi e 2 guardiani")).toBeInTheDocument();
  });

  it("shows the sub-counter at 0 e 0 when there are friends but none qualify yet", () => {
    const context = buildContext({
      friends: [buildFriend({ status: "revoked", isGuardian: false })],
    });

    render(<DashboardCounters context={context} />);
    expect(screen.getByText("0 attivi e 0 guardiani")).toBeInTheDocument();
  });
});
