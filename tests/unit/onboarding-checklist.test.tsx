import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/OnboardingChecklist";

const steps: OnboardingStep[] = [
  { key: "account", label: "Crea un account", description: "d1", done: true, href: "/dashboard" },
  { key: "security", label: "Configura la cifratura", description: "d2", done: true, href: "/archive" },
  { key: "document", label: "Aggiungi il primo documento", description: "d3", done: false, href: "/archive" },
  { key: "category", label: "Assegna una categoria", description: "d4", done: false, href: "/archive" },
];

describe("OnboardingChecklist", () => {
  it("shows the heading 'Onboarding' and counts every step in the progress indicator", () => {
    render(<OnboardingChecklist steps={steps} />);
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
    // 2 done ("account", "security") out of 4 total --- nothing is optional anymore.
    expect(screen.getByText("2/4")).toBeInTheDocument();
  });

  it("renders a done step as plain text (not struck through, not a link)", () => {
    render(<OnboardingChecklist steps={steps} />);
    const doneText = screen.getByText("Crea un account");
    expect(doneText).toBeInTheDocument();
    expect(doneText).not.toHaveClass("line-through");
    expect(screen.queryByRole("link", { name: "Crea un account" })).not.toBeInTheDocument();
  });

  it("renders a pending step as a clickable link to where it can be completed", () => {
    render(<OnboardingChecklist steps={steps} />);
    const link = screen.getByRole("link", { name: "Aggiungi il primo documento" });
    expect(link).toHaveAttribute("href", "/archive");
  });

  it("never marks any step as optional", () => {
    render(<OnboardingChecklist steps={steps} />);
    expect(screen.queryByText("(opzionale)")).not.toBeInTheDocument();
  });
});
