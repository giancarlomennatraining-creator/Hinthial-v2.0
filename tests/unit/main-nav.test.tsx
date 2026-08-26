import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MainNav } from "@/components/layout/MainNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/vault",
}));

describe("MainNav", () => {
  it("renders every navigation item", () => {
    render(<MainNav />);

    for (const label of [
      "Dashboard",
      "Vault",
      "Scadenze",
      "Asset",
      "Contatti",
      "Capsule",
      "AI",
      "Impostazioni",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the link matching the current path as the current page", () => {
    render(<MainNav />);

    expect(screen.getByRole("link", { name: "Vault" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
