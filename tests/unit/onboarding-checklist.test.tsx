import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/OnboardingChecklist";

const steps: OnboardingStep[] = [
  { key: "account", label: "Crea un account", done: true, href: "/dashboard" },
  { key: "security", label: "Configura la cifratura", done: true, href: "/archive" },
  { key: "document", label: "Aggiungi il primo documento", done: false, href: "/archive" },
  { key: "category", label: "Assegna una categoria", done: false, href: "/archive" },
  { key: "reminder", label: "Imposta una scadenza", done: false, href: "/reminders", optional: true },
];

describe("OnboardingChecklist", () => {
  it("counts only mandatory steps in the progress indicator", () => {
    render(<OnboardingChecklist steps={steps} />);
    // 2 mandatory steps done ("account", "security") out of 4 mandatory total --- the optional 5th is excluded from both numbers.
    expect(screen.getByText("2/4")).toBeInTheDocument();
  });

  it("renders a done step as struck-through text, not a link", () => {
    render(<OnboardingChecklist steps={steps} />);
    expect(screen.getByText("Crea un account")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Crea un account" })).not.toBeInTheDocument();
  });

  it("renders a pending step as a clickable link to where it can be completed", () => {
    render(<OnboardingChecklist steps={steps} />);
    const link = screen.getByRole("link", { name: "Aggiungi il primo documento" });
    expect(link).toHaveAttribute("href", "/archive");
  });

  it("marks the optional step as such", () => {
    render(<OnboardingChecklist steps={steps} />);
    expect(screen.getByText("(opzionale)")).toBeInTheDocument();
  });
});
