import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardStories } from "@/components/dashboard/DashboardStories";
import { buildStories } from "@/domain/dashboard/stories";
import type { SummaryContext } from "@/domain/ai/types";
import type { ReminderListItem } from "@/domain/reminders/types";

const NOW = new Date(2026, 9, 7, 10, 30);

function on(dayOffset: number, hour = 9): string {
  return new Date(2026, 9, 7 + dayOffset, hour).toISOString();
}

function reminder(id: string, title: string, dayOffset: number, overrides: Partial<ReminderListItem> = {}): ReminderListItem {
  return {
    id, title, dueAt: on(dayOffset), completed: false,
    relatedDocumentId: null, relatedDocumentFilename: null, relatedAssetId: null, relatedAssetName: null,
    createdAt: "2026-01-01T00:00:00Z", ...overrides,
  };
}

function context(overrides: Partial<SummaryContext> = {}): SummaryContext {
  return { categories: [], assets: [], documents: [], reminders: [], friends: [], capsules: [], ...overrides };
}

beforeEach(() => {
  // jsdom non ha matchMedia: si finge uno che chiede meno movimento, così i numeri compaiono subito interi.
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never;
});

describe("buildStories", () => {
  it("conta le cose che chiedono attenzione e prende le prime tre scadenze, le passate per prime", () => {
    const data = buildStories(
      context({ reminders: [reminder("a", "Revisione", -9), reminder("b", "Bollo", 5), reminder("c", "Luce", 8), reminder("d", "IMU", 70), reminder("e", "Fatta", 1, { completed: true })] }),
      NOW,
    );
    expect(data.attention).toEqual({ count: 2, overdue: 1, thisWeek: 1 });
    expect(data.upcoming.map((u) => u.id)).toEqual(["a", "b", "c"]);
    expect(data.upcoming[0]).toMatchObject({ days: -9 });
  });

  it("a vault vuoto non ha nulla e non si rompe", () => {
    const data = buildStories(context(), NOW);
    expect(data.attention.count).toBe(0);
    expect(data.upcoming).toEqual([]);
    expect(data.capsule).toBeNull();
    expect(data.archive).toMatchObject({ newThisWeek: 0, total: 0 });
  });
});

function renderStories(ctx: SummaryContext) {
  return render(<DashboardStories supabase={{} as never} masterKey={{} as CryptoKey} context={ctx} now={NOW} />);
}

const story = () => screen.getByRole("group", { name: /^Storia \d di 5/ });
const headline = () => within(story()).getByRole("heading", { level: 3 });

describe("DashboardStories", () => {
  const ctx = context({
    reminders: [reminder("a", "Revisione Ford Focus", -9), reminder("b", "Bollo auto", 5, { relatedAssetName: "Ford Focus" }), reminder("c", "Luce", 20)],
    capsules: [
      { id: "c1", title: "Messaggio per Luca", openAt: on(62), relatedFriends: [{ name: "Luca Bianchi", firstName: "Luca" }] },
      { id: "c2", title: "Altra", openAt: on(120), relatedFriends: [] },
    ] as never,
  });

  it("parte dalla storia 'Oggi' con quante cose chiedono attenzione", () => {
    renderStories(ctx);

    expect(story()).toHaveAttribute("aria-label", "Storia 1 di 5: Oggi");
    expect(headline()).toHaveTextContent("cose chiedono attenzione oggi");
    expect(screen.getByText("Una è già scaduta e una arriva questa settimana.")).toBeInTheDocument();
  });

  it("'Vedi le scadenze' porta alla storia delle scadenze, con i giorni e il bene", () => {
    renderStories(ctx);

    fireEvent.click(screen.getByRole("button", { name: /Vedi le scadenze/ }));
    expect(story()).toHaveAttribute("aria-label", "Storia 2 di 5: Scadenze");
    expect(screen.getByText("Revisione Ford Focus")).toBeInTheDocument();
    expect(screen.getByText("scaduta da 9 giorni")).toBeInTheDocument();
    expect(screen.getByText("tra 5 giorni · Ford Focus")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tutte le scadenze/ })).toHaveAttribute("href", "/reminders");
  });

  it("tocca a destra per avanzare, a sinistra per tornare; dall'ultima si riparte dalla prima", () => {
    renderStories(ctx);

    fireEvent.click(screen.getByRole("button", { name: "Storia successiva" }));
    fireEvent.click(screen.getByRole("button", { name: "Storia successiva" }));
    expect(story()).toHaveAttribute("aria-label", "Storia 3 di 5: Archivio");
    fireEvent.click(screen.getByRole("button", { name: "Storia precedente" }));
    expect(story()).toHaveAttribute("aria-label", "Storia 2 di 5: Scadenze");

    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Storia successiva" }));
    expect(story()).toHaveAttribute("aria-label", "Storia 1 di 5: Oggi");
    // Dalla prima non si va più indietro.
    fireEvent.click(screen.getByRole("button", { name: "Storia precedente" }));
    expect(story()).toHaveAttribute("aria-label", "Storia 1 di 5: Oggi");
  });

  it("si naviga anche con le frecce della tastiera", () => {
    renderStories(ctx);

    fireEvent.keyDown(story(), { key: "ArrowRight" });
    expect(story()).toHaveAttribute("aria-label", "Storia 2 di 5: Scadenze");
    fireEvent.keyDown(story(), { key: "ArrowLeft" });
    expect(story()).toHaveAttribute("aria-label", "Storia 1 di 5: Oggi");
  });

  it("il pulsante di pausa ferma l'avanzamento, tenere premuto lo ferma finché si tiene", () => {
    renderStories(ctx);

    const pause = screen.getByRole("button", { name: "Pausa" });
    fireEvent.click(pause);
    expect(screen.getByRole("button", { name: "Riprendi" })).toHaveAttribute("aria-pressed", "true");
    expect(story().className).toContain("story-paused");
    fireEvent.click(screen.getByRole("button", { name: "Riprendi" }));
    expect(story().className).not.toContain("story-paused");

    fireEvent.pointerDown(story());
    expect(story().className).toContain("story-paused");
    fireEvent.pointerUp(story());
    expect(story().className).not.toContain("story-paused");
  });

  it("tenere premuto su un pulsante non ferma le storie", () => {
    renderStories(ctx);

    fireEvent.pointerDown(screen.getByRole("button", { name: /Vedi le scadenze/ }));
    expect(story().className).not.toContain("story-paused");
  });

  it("la storia delle capsule dice quando si apre, i giorni e quante altre ce ne sono", () => {
    renderStories(ctx);

    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Storia successiva" }));
    expect(story()).toHaveAttribute("aria-label", "Storia 4 di 5: Capsule");
    expect(headline()).toHaveTextContent("si apre «Messaggio per Luca»");
    expect(screen.getByText(/giorni all'apertura per Luca/)).toBeInTheDocument();
    expect(story()).toHaveTextContent("Un'altra capsula è programmata.");
  });

  it("l'ultima storia dice cosa manca ai primi passi e porta lì", () => {
    renderStories(ctx);

    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Storia successiva" }));
    expect(story()).toHaveAttribute("aria-label", "Storia 5 di 5: Primi passi");
    expect(headline()).toHaveTextContent("Manca un passo: aggiungi il primo contenuto all'archivio");
    expect(story()).toHaveTextContent("4 passi su 8 completati");
    expect(screen.getByRole("link", { name: /Vai al passo/ })).toHaveAttribute("href", "/archive");
  });

  it("a vault vuoto ogni storia ha un testo gentile", () => {
    renderStories(context());

    expect(headline()).toHaveTextContent("Tutto in ordine oggi");
    fireEvent.click(screen.getByRole("button", { name: "Storia successiva" }));
    expect(headline()).toHaveTextContent("Nessuna scadenza in arrivo");
    fireEvent.click(screen.getByRole("button", { name: "Storia successiva" }));
    expect(story()).toHaveTextContent("Ancora nulla in archivio.");
    fireEvent.click(screen.getByRole("button", { name: "Storia successiva" }));
    expect(headline()).toHaveTextContent("Nessuna capsula in programma");
  });
});
