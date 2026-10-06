import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadingRegister } from "@/components/documents/ReadingRegister";
import type { AnalysisOverview } from "@/domain/ai/analysis/overview";
import { buildRegisterRows, registerProgress } from "@/domain/ai/analysis/register";
import type { Category } from "@/domain/categories/types";
import type { ContentSegment } from "@/domain/extraction/types";
import type { Proposal, ProposalRejection } from "@/domain/proposals/types";

const SEGMENTS: ContentSegment[] = [
  { id: "p1", kind: "page", index: 1, text: "Polizza n. IT-4471 di Generali." },
  { id: "p2", kind: "page", index: 2, text: "Condizioni.\nValida fino al 3 giugno 2027.\nFine." },
];

const CATEGORIES: Category[] = [
  { id: "c-ass", name: "Assicurazioni", icon: "🛡️", aiExtractionEnabled: false, aiExtractionEnabledUntil: null },
];

const OVERVIEW: AnalysisOverview = {
  typeLabel: "Polizza assicurativa",
  typeRecognized: true,
  coverage: { read: 1, total: 1, truncated: false },
  facts: [
    { id: "category", kind: "category", label: "Categoria", value: "Assicurazioni", valueType: "text", quote: "Polizza RCA", provenance: { segmentId: "p1", page: 1 }, adopted: false },
    { id: "expiry-0", kind: "expiry", label: "Scadenza", value: "2027-06-03", valueType: "date", quote: "Valida fino al 3 giugno 2027.", provenance: { segmentId: "p2", page: 2 }, adopted: false },
    { id: "issuer-0", kind: "issuer", label: "Emittente", value: "Generali", valueType: "text", quote: "di Generali", provenance: { segmentId: "p1", page: 1 }, adopted: true },
    { id: "field-numero_polizza", kind: "field", label: "Numero polizza", value: "IT-4471", valueType: "text", quote: "Polizza n. IT-4471", provenance: { segmentId: "p1", page: 1 }, adopted: false },
    { id: "field-premio", kind: "field", label: "Premio", value: "EUR 612,40", valueType: "text", quote: "Premio EUR 612,40", provenance: { segmentId: "p1", page: 1 }, adopted: true },
    { id: "event-2020-09-12", kind: "event", label: "Pagamento rata", value: "2020-09-12", valueType: "date", quote: "rata entro il 12/09/2020", provenance: { segmentId: "p1", page: 1 }, adopted: false },
  ],
};

const PROPOSALS: Proposal[] = [
  { kind: "category", value: "c-ass", source: "Polizza RCA", aiGenerated: true },
  { kind: "expiry", value: "2027-06-03", source: "Valida fino al 3 giugno 2027.", aiGenerated: true },
  { kind: "field", value: "IT-4471", source: "Polizza n. IT-4471", fieldKey: "numero_polizza", fieldLabel: "Numero polizza", aiGenerated: true },
];

const BASE = {
  overview: OVERVIEW,
  proposals: PROPOSALS,
  rejections: [] as ProposalRejection[],
  categories: CATEGORIES,
  assets: [],
  today: "2026-10-06",
  busy: false,
  segments: SEGMENTS,
  text: "",
};

function setup(over: Partial<React.ComponentProps<typeof ReadingRegister>> = {}) {
  const handlers = { onAccept: vi.fn(), onReject: vi.fn(), onRestore: vi.fn(), onAcceptAll: vi.fn() };
  render(<ReadingRegister {...BASE} acceptAllCount={3} {...handlers} {...over} />);
  return handlers;
}

describe("buildRegisterRows", () => {
  const rows = buildRegisterRows({ ...BASE, assets: [], proposals: PROPOSALS });
  const byId = (id: string) => rows.find((r) => r.id === id);

  it("unisce lettura e proposte: la riga con una proposta è da decidere, quella già nella Scheda è accettata", () => {
    expect(byId("expiry-0")?.state).toBe("pending");
    expect(byId("expiry-0")?.proposal).toBe(PROPOSALS[1]);
    expect(byId("issuer-0")?.state).toBe("adopted");
    expect(byId("type")?.state).toBe("info");
  });

  it("raggruppa: importi e date a parte, i dettagli a sé, e l'ordine del gruppo Documento", () => {
    expect(byId("field-premio")?.group).toBe("Importi e date");
    expect(byId("field-numero_polizza")?.group).toBe("Dettagli");
    expect(rows.filter((r) => r.group === "Documento").map((r) => r.id)).toEqual(["type", "category", "issuer-0", "expiry-0"]);
  });

  it("una data da ricordare già passata è di sola lettura e lo dice", () => {
    const past = byId("event-2020-09-12");
    expect(past?.state).toBe("info");
    expect(past?.note).toBe("Già passata");
    expect(past?.group).toBe("Collegamenti");
  });

  it("una riga rifiutata si può ripristinare, e le proposte senza lettura (il bene) diventano righe", () => {
    const rejection: ProposalRejection = { id: "r1", kind: "expiry", value: "2027-06-03" };
    const asset: Proposal = { kind: "asset", value: "Ford Focus (EY389YM)", createAsset: true, source: "Dal documento: targa EY389YM." };
    const withRejection = buildRegisterRows({ ...BASE, proposals: [asset], rejections: [rejection] });
    const expiry = withRejection.find((r) => r.id === "expiry-0");
    expect(expiry?.state).toBe("rejected");
    expect(expiry?.rejection).toBe(rejection);
    const bene = withRejection.find((r) => r.proposal === asset);
    expect(bene).toMatchObject({ group: "Collegamenti", label: "Bene", value: "Nuovo bene: Ford Focus (EY389YM)", state: "pending" });
  });

  it("conta il progresso senza le righe di sola lettura", () => {
    // Categoria, scadenza e numero polizza da decidere; emittente e premio già nella Scheda; il tipo e la rata passata no.
    expect(registerProgress(rows)).toEqual({ adopted: 2, pending: 3, total: 5 });
  });
});

describe("ReadingRegister", () => {
  it("mostra un solo elenco con i gruppi, il progresso e le voci di sola lettura", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Documento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Importi e date" })).toBeInTheDocument();
    expect(screen.getByText("Polizza assicurativa")).toBeInTheDocument();
    expect(screen.getByText(/Solo lettura/)).toBeInTheDocument();
    expect(screen.getByText(/di 5 nella Scheda/)).toBeInTheDocument();
    expect(screen.getByText(/3 da decidere/)).toBeInTheDocument();
    expect(screen.getAllByText("nella Scheda")).toHaveLength(2); // emittente e premio già accettati
  });

  it("Accetta, Modifica e No grazie stanno sulla riga e chiamano le azioni giuste", () => {
    const { onAccept, onReject } = setup();
    const accept = screen.getAllByRole("button", { name: "Accetta" });
    expect(accept).toHaveLength(3);
    // Nell'ordine dell'elenco: categoria, scadenza, poi il numero polizza tra i dettagli.
    fireEvent.click(accept[1]);
    expect(onAccept).toHaveBeenCalledWith(PROPOSALS[1], "2027-06-03");

    fireEvent.click(screen.getByRole("button", { name: "No, grazie: Scadenza" }));
    expect(onReject).toHaveBeenCalledWith(PROPOSALS[1]);
  });

  it("Modifica apre il campo giusto (una data col calendario) e Salva accetta il valore corretto", () => {
    const { onAccept } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Modifica Scadenza" }));
    const input = screen.getByLabelText("Scadenza da impostare");
    expect(input).toHaveAttribute("type", "date");
    fireEvent.change(input, { target: { value: "2028-01-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(onAccept).toHaveBeenCalledWith(PROPOSALS[1], "2028-01-15");
  });

  it("'Accetta le N rimaste' chiama l'azione", () => {
    const { onAcceptAll } = setup();
    expect(screen.getByRole("button", { name: "Accetta tutte le voci rimaste" })).toHaveTextContent("Accetta le 3 rimaste");
    fireEvent.click(screen.getByRole("button", { name: "Accetta tutte le voci rimaste" }));
    expect(onAcceptAll).toHaveBeenCalledTimes(1);
  });

  it("con tutto già nella Scheda il pulsante diventa 'Tutto nella Scheda' e non si può premere", () => {
    const adopted: AnalysisOverview = { ...OVERVIEW, facts: OVERVIEW.facts.map((f) => ({ ...f, adopted: true })) };
    setup({ overview: adopted, proposals: [], acceptAllCount: 0 });
    expect(screen.getByRole("button", { name: "Tutto nella Scheda" })).toBeDisabled();
  });

  it("una riga scartata si ripristina", () => {
    const rejection: ProposalRejection = { id: "r1", kind: "expiry", value: "2027-06-03" };
    const { onRestore } = setup({ proposals: [PROPOSALS[0], PROPOSALS[2]], rejections: [rejection], acceptAllCount: 2 });
    expect(screen.getByText("Scartata")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ripristina" }));
    expect(onRestore).toHaveBeenCalledWith(rejection);
  });

  it("il bene da creare ha il suo pulsante e si può rinominare prima di crearlo", () => {
    const asset: Proposal = { kind: "asset", value: "Ford Focus (EY389YM)", createAsset: true, source: "Dal documento: targa EY389YM. Non hai ancora un bene così." };
    const { onAccept } = setup({ proposals: [asset], overview: null, acceptAllCount: 0 });
    expect(screen.getByText("Nuovo bene: Ford Focus (EY389YM)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crea e collega" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Modifica Bene" }));
    fireEvent.change(screen.getByLabelText("Nome del bene da creare"), { target: { value: "La mia Focus" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(onAccept).toHaveBeenCalledWith(asset, "La mia Focus");
  });

  it("il collegamento a un bene che c'è già dice Collega, e Modifica fa scegliere un altro bene", () => {
    const link: Proposal = { kind: "asset", value: "a-panda", source: 'Stessa targa (AB123CD) di "Polizza.pdf", già collegato a Fiat Panda.' };
    const assets = [
      { id: "a-panda", name: "Fiat Panda", categoryId: null, createdAt: "2026-01-01" },
      { id: "a-casa", name: "Casa di Roma", categoryId: null, createdAt: "2026-01-02" },
    ];
    const { onAccept } = setup({ proposals: [link], assets, overview: null, acceptAllCount: 0 });
    expect(screen.getByText("Fiat Panda")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Modifica Bene" }));
    fireEvent.change(screen.getByLabelText("Bene da collegare"), { target: { value: "a-casa" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(onAccept).toHaveBeenCalledWith(link, "a-casa");
  });

  it("la pagina d'origine apre il testo letto con la frase evidenziata, e si richiude", () => {
    setup();
    expect(screen.queryByRole("region", { name: "Testo letto" })).toBeNull();
    const open = screen.getByRole("button", { name: "Mostra il punto d'origine di Scadenza" });
    fireEvent.click(open);
    const region = screen.getByRole("region", { name: "Testo letto" });
    expect(within(region).getByText("Valida fino al 3 giugno 2027.").tagName).toBe("MARK");
    fireEvent.click(open);
    expect(screen.queryByRole("region", { name: "Testo letto" })).toBeNull();
  });

  it("senza il testo di quella pagina (cambiato dopo la lettura) la provenienza resta una semplice etichetta", () => {
    const overview: AnalysisOverview = {
      ...OVERVIEW,
      facts: [{ ...OVERVIEW.facts[1], provenance: { segmentId: "p9", page: 9 } }],
    };
    setup({ overview, proposals: [PROPOSALS[1]], acceptAllCount: 1 });
    expect(screen.getByText("p. 9")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /punto d'origine/ })).toBeNull();
  });

  it("senza nulla letto lo dice", () => {
    setup({ overview: null, proposals: [], acceptAllCount: 0 });
    expect(screen.getByText(/non ha trovato dati/)).toBeInTheDocument();
  });
});
