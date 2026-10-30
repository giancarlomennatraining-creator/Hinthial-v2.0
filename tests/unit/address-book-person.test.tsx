import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddressBook } from "@/components/friends/AddressBook";
import type { CapsuleListItem, SharedCapsuleListItem } from "@/domain/capsules/types";
import type { FriendListItem } from "@/domain/friends/types";

function friend(over: Partial<FriendListItem> & { id: string; name: string }): FriendListItem {
  return {
    email: `${over.id}@esempio.it`, firstName: "", lastName: "", avatarPath: null, avatarUrl: null, role: "Amico",
    status: "active", isFriend: true, isGuardian: false, linkedUserId: null, createdAt: "2026-01-01T00:00:00Z", ...over,
  };
}

const capsule = (id: string, title: string, status: CapsuleListItem["status"], openOnLegacy: boolean) =>
  ({ id, title, status, openOnLegacy, createdAt: "2026-01-01T00:00:00Z", openAt: "2038-03-12T10:00:00Z" }) as CapsuleListItem;

function renderBook(
  people: FriendListItem[],
  { capsules = [], shared }: { capsules?: CapsuleListItem[]; shared?: SharedCapsuleListItem[] } = {},
) {
  return render(
    <AddressBook
      friends={people}
      capsulesFor={() => capsules}
      sharedFrom={shared ? () => shared : undefined}
      avatarUrlFor={() => null}
      isFriendRequestPending={() => false}
      isGuardianRequestPending={() => false}
      canRequestFriendship={() => false}
      busyId={null}
      onRequestFriendship={vi.fn()}
      onToggleGuardian={vi.fn()}
      renderMenu={() => null}
    />,
  );
}

describe("la scheda di una persona", () => {
  it("ha l'azione principale: scrivere una capsula per lei, con il suo nome di battesimo", () => {
    renderBook([friend({ id: "m", name: "Marta Rossi", firstName: "Marta" })]);
    const card = screen.getByRole("region", { name: "Scheda di Marta Rossi" });
    const link = within(card).getByRole("link", { name: "Scrivi una capsula per Marta" });
    expect(link).toHaveAttribute("href", "/capsules/new?da=persona:m");
  });

  it("non offre di scrivere a chi è stato revocato", () => {
    renderBook([friend({ id: "r", name: "Revocato Uno", status: "revoked" })]);
    const card = screen.getByRole("region", { name: "Scheda di Revocato Uno" });
    expect(within(card).queryByRole("link", { name: /Scrivi una capsula per/ })).toBeNull();
  });

  it("raggruppa le capsule e dice quali arrivano anche se non ci sei", () => {
    renderBook([friend({ id: "m", name: "Marta Rossi", firstName: "Marta" })], {
      capsules: [
        capsule("a", "Lettera per Marta", "shared", true),
        capsule("b", "Per le nozze", "shared", false),
        capsule("c", "Appunti", "draft", false),
      ],
    });
    const card = screen.getByRole("region", { name: "Scheda di Marta Rossi" });
    expect(within(card).getByText("3 capsule: 1 arriverà anche se non ci sei, 1 si apre alla propria data, 1 è ancora una bozza.")).toBeInTheDocument();
    expect(within(card).getByText("Anche prima, se non ci sono più")).toBeInTheDocument();
    expect(within(card).getByText("Alla sua data")).toBeInTheDocument();
    expect(within(card).getByText("Bozza")).toBeInTheDocument();
  });

  it("senza capsule lo dice, come prima", () => {
    renderBook([friend({ id: "m", name: "Marta Rossi", firstName: "Marta" })]);
    expect(screen.getByText("Nessuna capsula affidata a Marta.")).toBeInTheDocument();
  });

  it("per un guardiano spiega cosa succede", () => {
    renderBook([friend({ id: "g", name: "Giulia Neri", firstName: "Giulia", isGuardian: true, linkedUserId: "u1" })]);
    expect(screen.getByText(/chiederò a Giulia se riesce a raggiungerti/)).toBeInTheDocument();
  });

  it("se il guardiano non ha un account avverte che non potrà essere interpellato", () => {
    renderBook([friend({ id: "z", name: "Zeno Verdi", firstName: "Zeno", isGuardian: true, linkedUserId: null })]);
    expect(screen.getByText(/Zeno è un tuo guardiano ma non ha un account Hinthial/)).toBeInTheDocument();
  });

  it("mostra le capsule che la persona mi ha lasciato, quelle pronte da aprire per prime", () => {
    renderBook([friend({ id: "m", name: "Marta Rossi", firstName: "Marta", linkedUserId: "u-m" })], {
      shared: [
        { id: "s1", ownerId: "u-m", ownerName: "Marta Rossi", sharedAt: "2026-01-01", status: "shared", openAt: "2020-01-01T00:00:00Z", dismissedAt: null, released: false },
        { id: "s2", ownerId: "u-m", ownerName: "Marta Rossi", sharedAt: "2026-01-01", status: "shared", openAt: "2040-01-01T00:00:00Z", dismissedAt: null, released: false },
      ],
    });
    const card = screen.getByRole("region", { name: "Scheda di Marta Rossi" });
    expect(within(card).getByText("Da Marta per te")).toBeInTheDocument();
    expect(within(card).getByText(/2 capsule: 1 è pronta da aprire\./)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Apri le capsule →" })).toHaveAttribute("href", "/capsules?tab=shared");
  });

  it("senza capsule ricevute da lei, la sezione non c'è", () => {
    renderBook([friend({ id: "m", name: "Marta Rossi", firstName: "Marta", linkedUserId: "u-m" })], { shared: [] });
    expect(screen.queryByText("Da Marta per te")).toBeNull();
  });
});
