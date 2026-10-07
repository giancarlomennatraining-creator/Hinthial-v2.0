import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardBento } from "@/components/dashboard/DashboardBento";
import type { SummaryContext } from "@/domain/ai/types";
import type { ReminderListItem } from "@/domain/reminders/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const NOW = new Date(2026, 9, 7, 10, 30);

function reminder(id: string, title: string, dayOffset: number, overrides: Partial<ReminderListItem> = {}): ReminderListItem {
  return {
    id,
    title,
    dueAt: new Date(2026, 9, 7 + dayOffset, 9).toISOString(),
    completed: false,
    relatedDocumentId: null,
    relatedDocumentFilename: null,
    relatedAssetId: null,
    relatedAssetName: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function context(overrides: Partial<SummaryContext> = {}): SummaryContext {
  return { categories: [], assets: [], documents: [], reminders: [], friends: [], capsules: [], ...overrides };
}

beforeEach(() => push.mockReset());

describe("DashboardBento", () => {
  it("a vault vuoto mostra tutti i riquadri con un testo gentile, senza rompersi", () => {
    render(<DashboardBento context={context()} now={NOW} />);

    expect(screen.getByText(/Nessuna scadenza/)).toBeInTheDocument();
    expect(screen.getByText("Nessuna capsula in programma.")).toBeInTheDocument();
    expect(screen.getByText("Ancora nessuno in rubrica.")).toBeInTheDocument();
    expect(screen.getByText("Ancora nessun bene censito.")).toBeInTheDocument();
    expect(screen.getAllByText("Ancora nulla in archivio.")).toHaveLength(1);
    expect(screen.getByText("2/8")).toBeInTheDocument();
  });

  it("il riquadro grande dice la prossima scadenza e quanto manca, con scadute e prossime 30 giorni", () => {
    render(
      <DashboardBento
        context={context({ reminders: [reminder("a", "Revisione", -9), reminder("b", "Bollo auto", 5, { relatedAssetName: "Ford Focus" }), reminder("c", "Luce", 20)] })}
        now={NOW}
      />,
    );

    const hero = screen.getByRole("link", { name: /Prossima scadenza/ });
    expect(hero).toHaveAttribute("href", "/reminders");
    expect(hero).toHaveTextContent("Bollo auto");
    expect(hero).toHaveTextContent("tra 5 giorni");
    expect(hero).toHaveTextContent("lunedì 12 ottobre · Ford Focus");
    expect(hero).toHaveTextContent("1 scaduta");
    expect(hero).toHaveTextContent("2 nei prossimi 30 giorni");
  });

  it("ogni riquadro porta alla sua sezione", () => {
    render(<DashboardBento context={context()} now={NOW} />);

    expect(screen.getByRole("link", { name: /Archivio/ })).toHaveAttribute("href", "/archive");
    expect(screen.getByRole("link", { name: /Prossima capsula/ })).toHaveAttribute("href", "/capsules");
    expect(screen.getByRole("link", { name: /Amici/ })).toHaveAttribute("href", "/friends");
    expect(screen.getByRole("link", { name: /Beni/ })).toHaveAttribute("href", "/assets");
    // Mancano i passi dopo l'archivio: il riquadro porta a quello che manca.
    expect(screen.getByRole("link", { name: /Primi passi/ })).toHaveAttribute("href", "/archive");
  });

  it("i beni mostrano la scadenza che li riguarda e un'etichetta di stato", () => {
    render(
      <DashboardBento
        context={context({
          assets: [{ id: "a1", name: "Ford Focus" }, { id: "a2", name: "Casa" }] as never,
          reminders: [reminder("r1", "RCA", 27, { relatedAssetId: "a1" })],
        })}
        now={NOW}
      />,
    );

    const tile = screen.getByRole("link", { name: /Beni · 2/ });
    expect(within(tile).getByText("RCA · tra 27 giorni")).toBeInTheDocument();
    expect(within(tile).getByText("in arrivo")).toBeInTheDocument();
    expect(within(tile).getByText("nessuna scadenza")).toBeInTheDocument();
  });

  it("la domanda scritta qui porta a Hinthia già nel campo", () => {
    render(<DashboardBento context={context()} now={NOW} />);

    fireEvent.change(screen.getByLabelText("Domanda per Hinthia"), { target: { value: "Quando scade la RCA?" } });
    fireEvent.click(screen.getByRole("button", { name: "Chiedi" }));
    expect(push).toHaveBeenCalledWith("/ai?q=Quando%20scade%20la%20RCA%3F");
  });

  it("un suggerimento si invia con un tocco; il campo vuoto apre solo Hinthia", () => {
    render(<DashboardBento context={context({ reminders: [reminder("b", "Bollo auto", 5)] })} now={NOW} />);

    fireEvent.click(screen.getByRole("button", { name: "Quando scade Bollo auto?" }));
    expect(push).toHaveBeenLastCalledWith("/ai?q=Quando%20scade%20Bollo%20auto%3F");

    fireEvent.click(screen.getByRole("button", { name: "Chiedi" }));
    expect(push).toHaveBeenLastCalledWith("/ai");
  });
});
