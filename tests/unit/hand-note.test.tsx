import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyListCard } from "@/components/ui/EmptyListCard";

describe("note a mano di Foglia", () => {
  it("il testo di uno stato vuoto resta lo stesso, con la classe delle note a mano", () => {
    render(<EmptyListCard text="Nessun amico ancora." actionHref="/friends/new" actionLabel="Aggiungi la prima persona" />);
    const note = screen.getByText("Nessun amico ancora.");
    expect(note.className).toContain("hand-note");
  });

  it("la scrittura a mano vale solo in Foglia (predefinito o scelto), non in Notte né in Luce", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const rule = css.match(/([^{}]*\.hand-note[^{}]*)\{/);
    expect(rule, "manca la regola .hand-note").not.toBeNull();
    const selector = rule![1];
    expect(selector).toContain(':root:not([data-stile]) .hand-note');
    expect(selector).toContain(':root[data-stile="foglia"] .hand-note');
    expect(selector).not.toContain("notte");
    expect(selector).not.toContain("luce");
  });
});
