import { fireEvent, render, screen, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddressBook } from "@/components/friends/AddressBook";
import type { FriendListItem } from "@/domain/friends/types";

function friend(id: string, name: string): FriendListItem {
  return {
    id, name, email: `${id}@esempio.it`, firstName: "", lastName: "", avatarPath: null, avatarUrl: null, role: "Amico",
    status: "active", isFriend: true, isGuardian: false, linkedUserId: null, createdAt: "2026-01-01T00:00:00Z",
  };
}

const people = [friend("a", "Anna Rossi"), friend("m", "Marta Rossi")];

function renderBook() {
  return render(
    <AddressBook
      friends={people}
      capsulesFor={() => []}
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

function setPhone(isPhone: boolean) {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: isPhone,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as never;
  window.scrollTo = vi.fn() as never;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("AddressBook — tasto indietro", () => {
  it("su smartphone aprire una scheda aggiunge un passo alla cronologia, e 'indietro' torna alla rubrica", () => {
    setPhone(true);
    const push = vi.spyOn(window.history, "pushState");
    renderBook();

    fireEvent.click(screen.getByRole("button", { name: /Marta Rossi/ }));
    expect(push).toHaveBeenCalledWith({ rubricaPerson: "m" }, "");
    expect(screen.getByRole("region", { name: "Rubrica" }).className).toContain("hidden");

    // Il browser torna al passo di prima: lo stato non ha più la persona.
    act(() => {
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });
    expect(screen.getByRole("region", { name: "Rubrica" }).className).not.toContain("hidden");
    push.mockRestore();
  });

  it("'avanti' riapre la scheda della persona", () => {
    setPhone(true);
    renderBook();

    act(() => {
      window.history.replaceState({ rubricaPerson: "a" }, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate", { state: { rubricaPerson: "a" } }));
    });
    expect(screen.getByRole("region", { name: "Scheda di Anna Rossi" }).className).toContain("flex");
    expect(screen.getByRole("region", { name: "Rubrica" }).className).toContain("hidden");
  });

  it("'← Rubrica' usa 'indietro' se la scheda aveva aggiunto un passo, e chiude e basta altrimenti", () => {
    setPhone(true);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    renderBook();

    fireEvent.click(screen.getByRole("button", { name: /Marta Rossi/ }));
    fireEvent.click(screen.getByRole("button", { name: "← Rubrica" }));
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  it("su schermo largo la scheda non tocca la cronologia", () => {
    setPhone(false);
    const push = vi.spyOn(window.history, "pushState");
    renderBook();

    fireEvent.click(screen.getByRole("button", { name: /Marta Rossi/ }));
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });
});
