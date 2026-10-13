import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MainNav } from "@/components/layout/MainNav";
import type { MasterKeyStatus } from "@/components/crypto/MasterKeyProvider";

const pathname = { current: "/archive" };
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

// MainNav legge lo stato della Master Key solo per il pallino "richiede
// configurare la cifratura" (v. nav-setup-hint più sotto) --- mockato
// invece di un vero MasterKeyProvider per non dipendere da un client
// Supabase reale in un test di puro rendering. `current` è mutabile tra
// i singoli test, letto ad ogni chiamata dell'hook.
const mockStatus: { current: MasterKeyStatus } = { current: { kind: "unlocked", masterKey: {} as CryptoKey } };

vi.mock("@/components/crypto/MasterKeyProvider", () => ({
  useMasterKey: () => ({ status: mockStatus.current }),
}));

describe("MainNav", () => {
  it("renders every navigation item", () => {
    render(<MainNav />);

    for (const label of ["Oggi", "Amici", "Capsule", "Eredità digitale", "Archivio", "Hinthia"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }

    // Scadenze e Beni sono schede dell'Archivio, non voci di menu.
    expect(screen.queryByRole("link", { name: "Scadenze" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Beni" })).not.toBeInTheDocument();

    // "Impostazioni" ora vive nel menu utente (UserMenu), non qui.
    expect(screen.queryByRole("link", { name: "Impostazioni" })).not.toBeInTheDocument();
  });

  it("shows a decorative icon next to each label, excluded from the accessible name", () => {
    render(<MainNav />);

    // v. components/icons/nav-icons.tsx --- un SVG a tratto, non
    // un'emoji: aria-hidden, quindi non nel nome accessibile del link
    // (già verificato dal fatto che getByRole lo trova per "Archivio").
    const archivioLink = screen.getByRole("link", { name: "Archivio" });
    const icon = archivioLink.querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("marks the link matching the current path as the current page", () => {
    render(<MainNav />);

    expect(screen.getByRole("link", { name: "Archivio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Oggi" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("tiene acceso l'Archivio anche dentro le sue schede (Beni, Scadenze, Fascicoli)", () => {
    for (const path of ["/assets", "/reminders/new", "/dossiers"]) {
      cleanup();
      pathname.current = path;
      render(<MainNav />);
      expect(screen.getByRole("link", { name: "Archivio" })).toHaveAttribute("aria-current", "page");
    }
    pathname.current = "/archive";
  });

  describe("nav-setup-hint", () => {
    it("adds a description (not part of the accessible name) to encryption-gated items when not set up yet", () => {
      mockStatus.current = { kind: "not-set-up" };
      render(<MainNav />);

      // Il nome accessibile resta esattamente "Archivio": mai cambiato
      // dal pallino, altrimenti chi cerca il link per nome esatto
      // (screen reader o test) smetterebbe di trovarlo.
      const archivioLink = screen.getByRole("link", { name: "Archivio" });
      expect(archivioLink).toHaveAccessibleDescription(/richiede di configurare la cifratura/i);

      // Oggi non è dietro la Master Key: nessun avviso.
      const dashboardLink = screen.getByRole("link", { name: "Oggi" });
      expect(dashboardLink).toHaveAccessibleDescription("");

      mockStatus.current = { kind: "unlocked", masterKey: {} as CryptoKey };
    });

    it("shows no hint once encryption is configured (locked or unlocked)", () => {
      for (const status of [{ kind: "locked" as const }, { kind: "unlocked" as const, masterKey: {} as CryptoKey }]) {
        mockStatus.current = status;
        const { unmount } = render(<MainNav />);
        expect(screen.getByRole("link", { name: "Archivio" })).toHaveAccessibleDescription("");
        unmount();
      }
    });
  });
});
