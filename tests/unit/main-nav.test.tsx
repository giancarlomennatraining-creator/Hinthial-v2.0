import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MainNav } from "@/components/layout/MainNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/archive",
}));

describe("MainNav", () => {
  it("renders every navigation item", () => {
    render(<MainNav />);

    for (const label of [
      "Dashboard",
      "Archivio",
      "Scadenze",
      "Asset",
      "Contatti",
      "Capsule",
      "Cronologia",
      "AI",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }

    // "Impostazioni" ora vive nel menu utente (UserMenu), non qui.
    expect(screen.queryByRole("link", { name: "Impostazioni" })).not.toBeInTheDocument();
  });

  it("shows a decorative icon next to each label, excluded from the accessible name", () => {
    render(<MainNav />);

    const archivioLink = screen.getByRole("link", { name: "Archivio" });
    expect(archivioLink).toHaveTextContent("🗄️");
  });

  it("marks the link matching the current path as the current page", () => {
    render(<MainNav />);

    expect(screen.getByRole("link", { name: "Archivio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
