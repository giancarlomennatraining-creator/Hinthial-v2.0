import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MainNav } from "@/components/layout/MainNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/documenti",
}));

describe("MainNav", () => {
  it("renders every navigation item", () => {
    render(<MainNav />);

    for (const label of [
      "Dashboard",
      "Documenti",
      "Scadenze",
      "Asset",
      "Contatti",
      "Capsule",
      "AI",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }

    // "Impostazioni" ora vive nel menu utente (UserMenu), non qui.
    expect(screen.queryByRole("link", { name: "Impostazioni" })).not.toBeInTheDocument();
  });

  it("marks the link matching the current path as the current page", () => {
    render(<MainNav />);

    expect(screen.getByRole("link", { name: "Documenti" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
