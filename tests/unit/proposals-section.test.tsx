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
