import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalsSection } from "@/components/documents/ProposalsSection";
import type { Proposal } from "@/domain/proposals/types";

const PROPOSALS: Proposal[] = [
  { kind: "expiry", value: "2027-06-03", source: "Valida fino al 3 giugno 2027." },
  { kind: "issuer", value: "Generali Italia", source: "GENERALI ITALIA S.p.A." },
];

function setup(props: { acceptAllCount?: number; onAcceptAll?: () => void; proposals?: Proposal[] } = {}) {
  render(
    <ProposalsSection
      proposals={props.proposals ?? PROPOSALS}
      categories={[]}
      busy={false}
      onAccept={vi.fn()}
      onReject={vi.fn()}
      acceptAllCount={props.acceptAllCount}
      onAcceptAll={props.onAcceptAll}
    />,
  );
}

describe("ProposalsSection, Accetta tutto", () => {
  it("con almeno due informazioni mostra il pulsante e lo collega all'azione", () => {
    const onAcceptAll = vi.fn();
    setup({ acceptAllCount: 2, onAcceptAll });
    expect(screen.getByText(/ha trovato 2 informazioni/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accetta tutto" }));
    expect(onAcceptAll).toHaveBeenCalledTimes(1);
  });

  it("con una sola informazione non serve: c'è già Accetta", () => {
    setup({ acceptAllCount: 1, onAcceptAll: vi.fn(), proposals: PROPOSALS.slice(0, 1) });
    expect(screen.queryByRole("button", { name: "Accetta tutto" })).not.toBeInTheDocument();
  });

  it("senza onAcceptAll (proposte locali) non compare", () => {
    setup({ acceptAllCount: 2 });
    expect(screen.queryByRole("button", { name: "Accetta tutto" })).not.toBeInTheDocument();
  });
});

describe("ProposalsSection, pagina di provenienza", () => {
  it("mostra la pagina solo quando la proposta ne ha una", () => {
    setup({
      proposals: [
        { kind: "expiry", value: "2027-06-03", source: "Valida fino al 3 giugno 2027.", page: 3 },
        { kind: "issuer", value: "Generali Italia", source: "GENERALI ITALIA S.p.A." },
      ],
    });
    expect(screen.getByText("Pagina 3")).toBeInTheDocument();
    expect(screen.getAllByText(/^Pagina \d+$/)).toHaveLength(1);
  });
});

describe("ProposalsSection, collegamento a un bene", () => {
  const ASSETS = [
    { id: "a-panda", name: "Fiat Panda", categoryId: null, createdAt: "2026-01-01" },
    { id: "a-casa", name: "Casa di Roma", categoryId: null, createdAt: "2026-01-02" },
  ];
  const PROPOSAL: Proposal = {
    kind: "asset",
    value: "a-panda",
    source: 'Stessa targa (AB123CD) di "Polizza RCA.pdf", già collegato a Fiat Panda.',
  };

  it("mostra il nome del bene e il motivo, e il pulsante dice Collega", () => {
    const onAccept = vi.fn();
    render(
      <ProposalsSection proposals={[PROPOSAL]} categories={[]} assets={ASSETS} busy={false} onAccept={onAccept} onReject={vi.fn()} />,
    );
    expect(screen.getByText("Fiat Panda")).toBeInTheDocument();
    expect(screen.getByText(/Stessa targa \(AB123CD\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collega" }));
    expect(onAccept).toHaveBeenCalledWith(PROPOSAL, "a-panda");
  });

  it("Modifica permette di scegliere un altro bene", () => {
    const onAccept = vi.fn();
    render(
      <ProposalsSection proposals={[PROPOSAL]} categories={[]} assets={ASSETS} busy={false} onAccept={onAccept} onReject={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    fireEvent.change(screen.getByLabelText("Bene da collegare"), { target: { value: "a-casa" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(onAccept).toHaveBeenCalledWith(PROPOSAL, "a-casa");
  });
});

describe("ProposalsSection, bene da creare", () => {
  const CREATE: Proposal = {
    kind: "asset",
    value: "Ford Focus (EY389YM)",
    createAsset: true,
    source: "Dal documento: targa EY389YM. Non hai ancora un bene così.",
  };

  it("mostra il nome proposto e il pulsante dice Crea e collega", () => {
    const onAccept = vi.fn();
    render(<ProposalsSection proposals={[CREATE]} categories={[]} busy={false} onAccept={onAccept} onReject={vi.fn()} />);
    expect(screen.getByText("Nuovo bene: Ford Focus (EY389YM)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crea e collega" }));
    expect(onAccept).toHaveBeenCalledWith(CREATE, "Ford Focus (EY389YM)");
  });

  it("Modifica permette di cambiare il nome prima di crearlo", () => {
    const onAccept = vi.fn();
    render(<ProposalsSection proposals={[CREATE]} categories={[]} busy={false} onAccept={onAccept} onReject={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    fireEvent.change(screen.getByLabelText("Nome del bene da creare"), { target: { value: "La mia Focus" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(onAccept).toHaveBeenCalledWith(CREATE, "La mia Focus");
  });
});
