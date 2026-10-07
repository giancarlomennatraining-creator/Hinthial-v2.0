import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardToday } from "@/components/dashboard/DashboardToday";
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

function Harness({ initial, documents = [] }: { initial: ReminderListItem[]; documents?: unknown[] }) {
  const [reminders, setReminders] = useState(initial);
  const context = { categories: [], assets: [], documents, reminders, friends: [], capsules: [] } as SummaryContext;
  return (
    <ToastProvider>
      <DashboardToday
        supabase={{} as never}
        masterKey={{} as CryptoKey}
        context={context}
        now={NOW}
        patchReminder={(id, patch) => setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
      />
    </ToastProvider>
  );
}

beforeEach(() => {
  setReminderCompleted.mockReset().mockResolvedValue(undefined);
  setReminderDueAt.mockReset().mockResolvedValue(undefined);
});

describe("DashboardToday", () => {
  const items = [
    reminder("rev", "Revisione Ford Focus", -9, { relatedAssetName: "Ford Focus", relatedDocumentId: "d1", relatedDocumentFilename: "Libretto.pdf" }),
    reminder("bollo", "Bollo auto", 5),
    reminder("imu", "Saldo IMU", 70),
  ];

  it("dice quante cose meritano attenzione e mostra una carta per ognuna, con il documento collegato", () => {
    render(<Harness initial={items} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Oggi 2 cose meritano attenzione.");
    expect(screen.getByText("Revisione Ford Focus")).toBeInTheDocument();
    expect(screen.getByText("scaduta da 9 giorni")).toBeInTheDocument();
    expect(screen.getByText("Bollo auto")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Libretto.pdf" })).toHaveAttribute("href", "/archive/d1");
    // Quella oltre la settimana sta in "Più avanti", senza pulsanti.
    expect(screen.getByText("Saldo IMU")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Segna fatta" })).toHaveLength(2);
  });

  it("'Segna fatta' la salva e fa uscire la carta, aggiornando la frase e l'avanzamento", async () => {
    render(<Harness initial={items} />);

    const card = screen.getByText("Bollo auto").closest("li")!;
    fireEvent.click(within(card).getByRole("button", { name: "Segna fatta" }));

    await waitFor(() => expect(setReminderCompleted).toHaveBeenCalledWith(expect.anything(), "bollo", true));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Segna fatta" })).toHaveLength(1));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Oggi 1 cosa merita attenzione.");
    expect(screen.getByText("1 di 2 sistemate")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("'Rimanda di 7 giorni' sposta la scadenza: una già scaduta riparte da oggi, non dalla vecchia data", async () => {
    render(<Harness initial={items} />);

    const card = screen.getByText("Revisione Ford Focus").closest("li")!;
    fireEvent.click(within(card).getByRole("button", { name: "Rimanda di 7 giorni" }));

    await waitFor(() => expect(setReminderDueAt).toHaveBeenCalledTimes(1));
    const [, id, newDueAt] = setReminderDueAt.mock.calls[0];
    expect(id).toBe("rev");
    expect(new Date(newDueAt as string).getDate()).toBe(14); // 7 ottobre + 7, non 28 settembre + 7
    // Tra 7 giorni è ancora entro la settimana: resta tra le cose da fare.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Oggi 2 cose meritano attenzione.");
  });

  it("rimandare una scadenza di sette giorni la porta oltre la settimana, in 'Più avanti'", async () => {
    render(<Harness initial={items} />);

    const card = screen.getByText("Bollo auto").closest("li")!;
    fireEvent.click(within(card).getByRole("button", { name: "Rimanda di 7 giorni" }));

    await waitFor(() => expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Oggi 1 cosa merita attenzione."));
    expect(screen.getByText("Bollo auto").closest("li")?.textContent).not.toContain("Segna fatta");
  });

  it("se il salvataggio fallisce, la carta resta com'era", async () => {
    setReminderCompleted.mockRejectedValue(new Error("rete"));
    render(<Harness initial={items} />);

    const card = screen.getByText("Bollo auto").closest("li")!;
    fireEvent.click(within(card).getByRole("button", { name: "Segna fatta" }));

    await waitFor(() => expect(screen.getByText("Non è stato possibile segnarla come fatta — riprova.")).toBeInTheDocument());
    expect(screen.getByText("Bollo auto")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Oggi 2 cose meritano attenzione.");
  });

  it("senza nulla da fare lo dice", () => {
    render(<Harness initial={[reminder("imu", "Saldo IMU", 70)]} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Tutto in ordine.");
    expect(screen.getByText("Hai finito per oggi")).toBeInTheDocument();
  });

  it("scegliendo un giorno della settimana ne mostra le scadenze", async () => {
    render(<Harness initial={items} />);

    fireEvent.click(screen.getByRole("button", { name: /12 ottobre: 1 scadenze/ }));
    expect(screen.getByText(/lunedì 12 ottobre:/i, { exact: false })).toBeInTheDocument();
  });

  it("mostra i documenti recenti come schede con il nome e da quanto sono stati aggiunti (senza miniatura: una pagina disegnata)", () => {
    const docs = [
      { id: "d1", filename: "Polizza RCA.pdf", categoryId: null, hasThumbnail: false, createdAt: new Date(2026, 9, 7, 8).toISOString() },
      { id: "d2", filename: "Referto holter.pdf", categoryId: null, hasThumbnail: false, createdAt: new Date(2026, 9, 6, 8).toISOString() },
    ];
    render(<Harness initial={[]} documents={docs} />);

    const first = screen.getByRole("link", { name: "Apri Polizza RCA.pdf" });
    expect(first).toHaveAttribute("href", "/archive/d1");
    expect(first).toHaveTextContent("oggi");
    expect(screen.getByRole("link", { name: "Apri Referto holter.pdf" })).toHaveTextContent("ieri");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
