import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "@/components/layout/UserMenu";

const masterKey = { status: { kind: "unlocked", masterKey: {} } as { kind: string; masterKey?: unknown } };
const lockNow = vi.fn();

vi.mock("@/components/crypto/MasterKeyProvider", () => ({ useMasterKey: () => masterKey }));
vi.mock("@/components/crypto/UnlockPromptProvider", () => ({ useUnlockPrompt: () => ({ lockNow }) }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));

beforeEach(() => {
  masterKey.status = { kind: "unlocked", masterKey: {} };
  lockNow.mockReset();
});

function renderMenu() {
  render(<UserMenu userId="u1" firstName="Ada" lastName="Lovelace" displayName="Ada Lovelace" avatarUrl={null} />);
  fireEvent.click(screen.getByRole("button", { name: /Ada Lovelace/ }));
}

describe("UserMenu — Blocca Hinthial", () => {
  it("a cassaforte sbloccata il menu la offre, e toccarla la blocca e chiude il menu", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "Blocca Hinthial" }));
    expect(lockNow).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Impostazioni" })).not.toBeInTheDocument();
  });

  it("a cassaforte già bloccata o da creare non c'è nulla da bloccare", () => {
    masterKey.status = { kind: "locked" };
    renderMenu();
    expect(screen.queryByRole("button", { name: "Blocca Hinthial" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Impostazioni" })).toBeInTheDocument();
  });
});
