import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PastEventsNotice } from "@/components/documents/PastEventsNotice";
import { pastEventsOf } from "@/domain/ai/analyze-document";

const evidence = (value: string, title: string) => ({
  value,
  title,
  source: "citazione",
  provenance: { segmentId: "p1", page: 1 },
});

describe("pastEventsOf", () => {
  it("restituisce solo le date già passate, una per giorno, dalla più vecchia", () => {
    const events = [
      evidence("2026-09-12", "Pagamento fattura"),
      evidence("2027-03-20", "Controllo"),
      evidence("2026-08-01", "Rata"),
      evidence("2026-09-12", "Pagamento (di nuovo)"),
    ];
    expect(pastEventsOf({ events }, "2026-10-05")).toEqual([
      { date: "2026-08-01", title: "Rata" },
      { date: "2026-09-12", title: "Pagamento fattura" },
    ]);
  });

  it("la data di oggi non è passata, e senza eventi non c'è niente", () => {
    expect(pastEventsOf({ events: [evidence("2026-10-05", "Oggi")] }, "2026-10-05")).toEqual([]);
    expect(pastEventsOf({ events: [] }, "2026-10-05")).toEqual([]);
  });
});

describe("PastEventsNotice", () => {
  it("non mostra niente se non ci sono date passate", () => {
    const { container } = render(<PastEventsNotice events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dice quale data è stata scartata e perché", () => {
    render(<PastEventsNotice events={[{ date: "2026-09-12", title: "Pagamento fattura" }]} />);
    const note = screen.getByRole("complementary", { name: "Date già passate" });
    expect(note).toHaveTextContent("è già passata: non l'ho aggiunta a Scadenze");
    expect(note).toHaveTextContent("Pagamento fattura");
    expect(note).toHaveTextContent("2026");
  });

  it("al plurale elenca tutte le date", () => {
    render(
      <PastEventsNotice
        events={[
          { date: "2026-08-01", title: "Rata" },
          { date: "2026-09-12", title: "Pagamento" },
        ]}
      />,
    );
    expect(screen.getByRole("complementary")).toHaveTextContent("sono già passate");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
