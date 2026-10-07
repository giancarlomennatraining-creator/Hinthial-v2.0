import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardBoard } from "@/components/dashboard/DashboardBoard";
import { ToastProvider } from "@/components/ui/ToastProvider";
import type { SummaryContext } from "@/domain/ai/types";
import type { ReminderListItem } from "@/domain/reminders/types";

const setReminderCompleted = vi.fn();
const setReminderDueAt = vi.fn();

vi.mock("@/domain/reminders/repository", () => ({
  setReminderCompleted: (...args: unknown[]) => setReminderCompleted(...args),
  setReminderDueAt: (...args: unknown[]) => setReminderDueAt(...args),
}));

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

function Harness({ initial }: { initial: ReminderListItem[] }) {
  const [reminders, setReminders] = useState(initial);
  const context = { categories: [], assets: [], documents: [], reminders, friends: [], capsules: [] } as SummaryContext;
  return (
    <ToastProvider>
      <DashboardBoard
        supabase={{} as never}
        context={context}
        now={NOW}
        patchReminder={(id, patch) => setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
      />
    </ToastProvider>
  );
}

const items = [
  reminder("rev", "Revisione Ford Focus", -9, { relatedAssetName: "Ford Focus" }),
  reminder("bollo", "Bollo auto", 5),
  reminder("luce", "Bolletta luce", 20),
  reminder("imu", "Saldo IMU", 70),
  reminder("old", "Vecchia visita", -30, { completed: true }),
];

const column = (name: string) => screen.getByRole("region", { name });
const move = (title: string, target: string) => screen.getByRole("button", { name: `Sposta «${title}» in ${target}` });

beforeEach(() => {
  setReminderCompleted.mockReset().mockResolvedValue(undefined);
  setReminderDueAt.mockReset().mockResolvedValue(undefined);
});

describe("DashboardBoard — colonne e pulsanti", () => {
  it("mette ogni scadenza nella colonna del suo tempo, con quanto manca", () => {
    render(<Harness initial={items} />);

    expect(within(column("Da sistemare")).getByText("Revisione Ford Focus")).toBeInTheDocument();
    expect(within(column("Da sistemare")).getByText("scaduta da 9 giorni")).toBeInTheDocument();
    expect(within(column("Questa settimana")).getByText("Bollo auto")).toBeInTheDocument();
    expect(within(column("Questo mese")).getByText("Bolletta luce")).toBeInTheDocument();
    expect(within(column("Più avanti")).getByText("Saldo IMU")).toBeInTheDocument();
    expect(within(column("Fatte")).getByText("Vecchia visita")).toBeInTheDocument();
  });

  it("un pulsante sposta la carta: cambia colonna e data, salva e si può annullare", async () => {
    render(<Harness initial={items} />);

    fireEvent.click(move("Bollo auto", "Più avanti"));

    await waitFor(() => expect(setReminderDueAt).toHaveBeenCalledTimes(1));
    expect(setReminderDueAt.mock.calls[0][1]).toBe("bollo");
    expect(new Date(setReminderDueAt.mock.calls[0][2] as string).getDate()).toBe(6); // 7 ottobre + 60 giorni = 6 dicembre
    expect(setReminderCompleted).not.toHaveBeenCalled();
    expect(within(column("Più avanti")).getByText("Bollo auto")).toBeInTheDocument();
    expect(within(column("Questa settimana")).queryByText("Bollo auto")).not.toBeInTheDocument();
    expect(screen.getByText(/«Bollo auto» spostata in "Più avanti"/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    await waitFor(() => expect(within(column("Questa settimana")).getByText("Bollo auto")).toBeInTheDocument());
    expect(setReminderDueAt).toHaveBeenLastCalledWith(expect.anything(), "bollo", items[1].dueAt);
  });

  it("'Fatta' completa la scadenza, la porta in 'Fatte' e aggiorna il conteggio", async () => {
    render(<Harness initial={items} />);

    fireEvent.click(screen.getByRole("button", { name: "Segna fatta «Bollo auto»" }));

    await waitFor(() => expect(setReminderCompleted).toHaveBeenCalledWith(expect.anything(), "bollo", true));
    expect(setReminderDueAt).not.toHaveBeenCalled();
    expect(within(column("Fatte")).getByText("Bollo auto")).toBeInTheDocument();
    expect(screen.getByText("1 fatta oggi")).toBeInTheDocument();
  });

  it("una carta 'Fatta' si può riaprire spostandola in una colonna", async () => {
    render(<Harness initial={items} />);

    fireEvent.click(move("Vecchia visita", "Questo mese"));

    await waitFor(() => expect(setReminderCompleted).toHaveBeenCalledWith(expect.anything(), "old", false));
    expect(setReminderDueAt).toHaveBeenCalled();
    expect(within(column("Questo mese")).getByText("Vecchia visita")).toBeInTheDocument();
  });

  it("non offre di spostare in 'Da sistemare' né nella colonna in cui la carta già sta", () => {
    render(<Harness initial={items} />);

    expect(screen.queryByRole("button", { name: /in Da sistemare/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sposta «Bollo auto» in Questa settimana" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sposta «Bollo auto» in Questo mese" })).toBeInTheDocument();
  });

  it("se il salvataggio fallisce la carta torna dov'era", async () => {
    setReminderDueAt.mockRejectedValue(new Error("rete"));
    render(<Harness initial={items} />);

    fireEvent.click(move("Bollo auto", "Più avanti"));

    await waitFor(() => expect(screen.getByText("Non è stato possibile spostarla — riprova.")).toBeInTheDocument());
    expect(within(column("Questa settimana")).getByText("Bollo auto")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Annulla" })).not.toBeInTheDocument();
  });

  it("a lavagna vuota ogni colonna ha un testo gentile", () => {
    render(<Harness initial={[]} />);

    expect(within(column("Da sistemare")).getByText("Niente qui")).toBeInTheDocument();
    expect(within(column("Fatte")).getByText("Trascina qui ciò che hai fatto")).toBeInTheDocument();
  });
});

describe("DashboardBoard — trascinamento col mouse", () => {
  class FakePointerEvent extends MouseEvent {
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? "mouse";
    }
  }

  function dragOnto(card: HTMLElement, target: HTMLElement | null) {
    document.elementFromPoint = vi.fn(() => target);
    fireEvent.pointerDown(card, { pointerType: "mouse", button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 80, clientY: 90 });
    fireEvent.pointerUp(window, { pointerType: "mouse", clientX: 80, clientY: 90 });
  }

  beforeEach(() => {
    vi.stubGlobal("PointerEvent", FakePointerEvent);
  });

  it("trascinare una carta in un'altra colonna ne sposta la data", async () => {
    render(<Harness initial={items} />);
    const card = screen.getByText("Bollo auto").closest("li")!;

    dragOnto(card, column("Questo mese"));

    await waitFor(() => expect(setReminderDueAt).toHaveBeenCalledTimes(1));
    expect(within(column("Questo mese")).getByText("Bollo auto")).toBeInTheDocument();
  });

  it("trascinare in 'Fatte' la segna completata", async () => {
    render(<Harness initial={items} />);

    dragOnto(screen.getByText("Bollo auto").closest("li")!, column("Fatte"));

    await waitFor(() => expect(setReminderCompleted).toHaveBeenCalledWith(expect.anything(), "bollo", true));
  });

  it("trascinare in 'Da sistemare' è rifiutato: nulla viene salvato e la colonna lo dice", async () => {
    render(<Harness initial={items} />);

    dragOnto(screen.getByText("Bollo auto").closest("li")!, column("Da sistemare"));

    await waitFor(() => expect(screen.getByText(/Non si può rimandare indietro nel tempo/)).toBeInTheDocument());
    expect(column("Da sistemare").className).toContain("board-nope");
    expect(setReminderDueAt).not.toHaveBeenCalled();
    expect(setReminderCompleted).not.toHaveBeenCalled();
    expect(within(column("Questa settimana")).getByText("Bollo auto")).toBeInTheDocument();
  });

  it("un movimento minuscolo non è un trascinamento, e rilasciare fuori dalle colonne non fa nulla", async () => {
    render(<Harness initial={items} />);
    const card = screen.getByText("Bollo auto").closest("li")!;

    document.elementFromPoint = vi.fn(() => column("Fatte"));
    fireEvent.pointerDown(card, { pointerType: "mouse", button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 12, clientY: 11 });
    fireEvent.pointerUp(window, { pointerType: "mouse", clientX: 12, clientY: 11 });
    dragOnto(card, null);

    expect(setReminderCompleted).not.toHaveBeenCalled();
    expect(setReminderDueAt).not.toHaveBeenCalled();
  });

  it("col dito non parte nessun trascinamento (ci sono i pulsanti)", () => {
    render(<Harness initial={items} />);
    const card = screen.getByText("Bollo auto").closest("li")!;

    document.elementFromPoint = vi.fn(() => column("Fatte"));
    fireEvent.pointerDown(card, { pointerType: "touch", button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { pointerType: "touch", clientX: 80, clientY: 90 });
    fireEvent.pointerUp(window, { pointerType: "touch", clientX: 80, clientY: 90 });

    expect(setReminderCompleted).not.toHaveBeenCalled();
  });
});
