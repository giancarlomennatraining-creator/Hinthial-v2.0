import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIChatProvider, useAIChat } from "@/components/ai/AIChatProvider";
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

describe("UserMenu — Blocca la cassaforte", () => {
  it("a cassaforte sbloccata il menu la offre, e toccarla la blocca e chiude il menu", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "Blocca la cassaforte" }));
    expect(lockNow).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Impostazioni" })).not.toBeInTheDocument();
  });

  it("a cassaforte già bloccata o da creare non c'è nulla da bloccare", () => {
    masterKey.status = { kind: "locked" };
    renderMenu();
    expect(screen.queryByRole("button", { name: "Blocca la cassaforte" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Impostazioni" })).toBeInTheDocument();
  });
});

describe("chat di Hinthia", () => {
  function Chat() {
    const { messages, addMessages } = useAIChat();
    return (
      <>
        <button onClick={() => addMessages([{ role: "user", text: "Quando scade la RCA?", createdAt: 1 }])}>scrivi</button>
        <ul>
          {messages.map((m) => (
            <li key={m.text}>{m.text}</li>
          ))}
        </ul>
      </>
    );
  }

  it("bloccando la cassaforte la conversazione sparisce (contiene dati in chiaro); sbloccando si riparte pulita", () => {
    const { rerender } = render(
      <AIChatProvider>
        <Chat />
      </AIChatProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "scrivi" }));
    expect(screen.getByText("Quando scade la RCA?")).toBeInTheDocument();

    masterKey.status = { kind: "locked" };
    act(() => {
      rerender(
        <AIChatProvider>
          <Chat />
        </AIChatProvider>,
      );
    });
    expect(screen.queryByText("Quando scade la RCA?")).not.toBeInTheDocument();

    masterKey.status = { kind: "unlocked", masterKey: {} };
    rerender(
      <AIChatProvider>
        <Chat />
      </AIChatProvider>,
    );
    expect(screen.queryByText("Quando scade la RCA?")).not.toBeInTheDocument();
  });
});
