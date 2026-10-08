import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnlockDialog } from "@/components/crypto/UnlockDialog";
import { UNLOCK_EXIT_MS } from "@/lib/unlock-style";

const masterKey = {
  status: { kind: "locked" } as { kind: string },
  unlockWithPassword: vi.fn(),
  unlockWithRecoveryKey: vi.fn(),
  unlockWithDeviceLock: vi.fn(),
  deviceLockAvailable: false,
};

vi.mock("@/components/crypto/MasterKeyProvider", () => ({ useMasterKey: () => masterKey }));
vi.mock("@/components/crypto/DevicePairingUnlock", () => ({ DevicePairingUnlock: () => <div data-testid="pairing" /> }));

let reducedMotion = false;

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = false;
  masterKey.status = { kind: "locked" };
  masterKey.deviceLockAvailable = false;
  masterKey.unlockWithPassword.mockReset().mockResolvedValue(undefined);
  masterKey.unlockWithRecoveryKey.mockReset().mockResolvedValue(undefined);
  masterKey.unlockWithDeviceLock.mockReset().mockResolvedValue(undefined);
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: reducedMotion,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as never;
});

afterEach(() => vi.useRealTimers());

const noop = () => {};

function open(props: Partial<React.ComponentProps<typeof UnlockDialog>> = {}) {
  const onDone = vi.fn();
  const onDismiss = vi.fn();
  render(<UnlockDialog style="glass" dismissible={false} demo={false} onDismiss={onDismiss} onDone={onDone} {...props} />);
  return { onDone, onDismiss };
}

async function type(value: string) {
  const field = (screen.queryByLabelText("Master password") ?? screen.getByLabelText("Recovery key")) as HTMLInputElement;
  fireEvent.change(field, { target: { value } });
  return field;
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sblocca" }));
  });
}

const phase = () => document.querySelector("[data-phase]")!.getAttribute("data-phase");

describe("UnlockDialog — password", () => {
  it("è una finestra con titolo 'Sblocca' e il campo della master password", () => {
    open();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: "Sblocca" })).toBeInTheDocument();
    expect(screen.getByLabelText("Master password")).toHaveAttribute("type", "password");
    expect(phase()).toBe("idle");
  });

  it("scrivendo lo stato passa a 'mentre si scrive'", async () => {
    open();
    await type("a");
    expect(phase()).toBe("typing");
  });

  it("una password giusta sblocca, mostra il successo e chiude la finestra alla fine dell'animazione", async () => {
    const { onDone } = open();
    await type("la-password");
    await submit();

    expect(masterKey.unlockWithPassword).toHaveBeenCalledWith("la-password");
    expect(phase()).toBe("success");
    expect(onDone).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(UNLOCK_EXIT_MS.glass - 50));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("una password sbagliata mostra l'errore e lo stato 'errore'", async () => {
    masterKey.unlockWithPassword.mockRejectedValue(new Error("Decryption failed"));
    const { onDone } = open();
    await type("sbagliata");
    await submit();

    expect(screen.getByRole("alert")).toHaveTextContent("Non corretta. Riprova.");
    expect(phase()).toBe("error");
    expect(screen.getByLabelText("Master password")).toHaveAttribute("aria-invalid", "true");
    act(() => vi.advanceTimersByTime(5000));
    expect(onDone).not.toHaveBeenCalled();

    // Riscrivendo l'errore sparisce.
    await type("riprovo");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(phase()).toBe("typing");
  });

  it("si può usare la recovery key al posto della password", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Hai perso la password? Usa la recovery key" }));

    expect(screen.getByLabelText("Recovery key")).toBeInTheDocument();
    expect(screen.queryByLabelText("Master password")).not.toBeInTheDocument();
    await type("AAAA-BBBB");
    await submit();
    expect(masterKey.unlockWithRecoveryKey).toHaveBeenCalledWith("AAAA-BBBB");
    expect(masterKey.unlockWithPassword).not.toHaveBeenCalled();

    expect(screen.getByRole("button", { name: "Usa invece la master password" })).toBeInTheDocument();
  });

  it("con 'meno movimento' si chiude quasi subito", async () => {
    reducedMotion = true;
    const { onDone } = open({ style: "vault" });
    await type("x");
    await submit();

    act(() => vi.advanceTimersByTime(300));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("se il vault si sblocca per un'altra strada (il QR) la finestra mostra il successo e si chiude", () => {
    const onDone = vi.fn();
    const { rerender } = render(<UnlockDialog style="glass" dismissible={false} demo={false} onDismiss={noop} onDone={onDone} />);
    expect(phase()).toBe("idle");

    // Il provider reale ri-renderizza quando lo stato del vault cambia: qui si fa lo stesso.
    masterKey.status = { kind: "unlocked" };
    rerender(<UnlockDialog style="glass" dismissible={false} demo={false} onDismiss={noop} onDone={onDone} />);
    expect(phase()).toBe("success");
    act(() => vi.advanceTimersByTime(UNLOCK_EXIT_MS.glass + 50));
    expect(onDone).toHaveBeenCalled();
  });
});

describe("UnlockDialog — impronta e chiusura", () => {
  it("il pulsante dell'impronta compare solo se il dispositivo la supporta, e sblocca", async () => {
    const { rerender } = render(
      <UnlockDialog style="glass" dismissible={false} demo={false} onDismiss={noop} onDone={noop} />,
    );
    expect(screen.queryByRole("button", { name: /Impronta/ })).not.toBeInTheDocument();
    rerender(<></>);

    masterKey.deviceLockAvailable = true;
    const { onDone } = open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sblocca con impronta/Face ID" }));
    });
    expect(masterKey.unlockWithDeviceLock).toHaveBeenCalledTimes(1);
    expect(phase()).toBe("success");
    act(() => vi.advanceTimersByTime(UNLOCK_EXIT_MS.glass + 50));
    expect(onDone).toHaveBeenCalled();
  });

  it("se l'impronta non riesce mostra l'errore e la password resta usabile", async () => {
    masterKey.deviceLockAvailable = true;
    masterKey.unlockWithDeviceLock.mockRejectedValue(new Error("Annullato"));
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sblocca con impronta/Face ID" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Annullato");
    expect(phase()).toBe("error");
    expect(screen.getByLabelText("Master password")).toBeInTheDocument();
  });

  it("chiudibile: 'Più tardi' ed Esc chiudono; non chiudibile: né l'uno né l'altro", () => {
    const first = open({ dismissible: true });
    fireEvent.click(screen.getByRole("button", { name: "Più tardi" }));
    expect(first.onDismiss).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(first.onDismiss).toHaveBeenCalledTimes(2);
  });

  it("non chiudibile: niente 'Più tardi' e Esc non fa nulla", () => {
    const { onDismiss } = open({ dismissible: false });
    expect(screen.queryByRole("button", { name: "Più tardi" })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe("UnlockDialog — pelle Cassaforte", () => {
  it("la ruota gira a ogni carattere scritto", async () => {
    open({ style: "vault" });
    expect(screen.getByRole("heading", { name: "Sblocca" })).toBeInTheDocument();
    const dial = document.querySelector(".unlock-dial") as SVGElement;
    expect(dial.getAttribute("style")).toContain("--dial: 0deg");

    await type("abc");
    expect(dial.getAttribute("style")).toContain("--dial: 81deg");
  });

  it("l'uscita è lenta e senza stacchi: la finestra si chiude solo dopo che la porta si è aperta", async () => {
    expect(UNLOCK_EXIT_MS.vault).toBeGreaterThanOrEqual(2500);
    const { onDone } = open({ style: "vault" });
    await type("la-password");
    await submit();

    expect(phase()).toBe("success");
    act(() => vi.advanceTimersByTime(1500));
    expect(onDone).not.toHaveBeenCalled(); // a metà, la porta si sta ancora aprendo
    act(() => vi.advanceTimersByTime(UNLOCK_EXIT_MS.vault));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("UnlockDialog — pelle Impronta", () => {
  it("senza impronta sul dispositivo l'anello non è un pulsante e la password è già a vista", () => {
    open({ style: "fingerprint" });

    expect(screen.queryByRole("button", { name: "Sblocca con impronta/Face ID" })).not.toBeInTheDocument();
    expect(document.querySelector(".unlock-fp-wrap")).toHaveAttribute("data-open", "true");
    expect(screen.getByLabelText("Master password")).toBeInTheDocument();
  });

  it("con l'impronta l'anello si tocca per sbloccare e la password sta in un cassetto da aprire", async () => {
    masterKey.deviceLockAvailable = true;
    const { onDone } = open({ style: "fingerprint" });

    const wrap = document.querySelector(".unlock-fp-wrap")!;
    expect(wrap).toHaveAttribute("data-open", "false");
    const toggle = screen.getByRole("button", { name: "Usa la master password" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(wrap).toHaveAttribute("data-open", "true");
    expect(screen.getByRole("button", { name: "Nascondi la master password" })).toHaveAttribute("aria-expanded", "true");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sblocca con impronta/Face ID" }));
    });
    expect(masterKey.unlockWithDeviceLock).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(UNLOCK_EXIT_MS.fingerprint + 50));
    expect(onDone).toHaveBeenCalled();
  });
});

describe("UnlockDialog — anteprima", () => {
  it("dice che è un'anteprima, non sblocca nulla e riesce con qualunque testo", async () => {
    const { onDone } = open({ demo: true, dismissible: true });

    expect(screen.getByText(/Anteprima/)).toBeInTheDocument();
    expect(screen.queryByTestId("pairing")).not.toBeInTheDocument();
    await type("quello che voglio");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sblocca" }));
      vi.advanceTimersByTime(800);
    });

    expect(masterKey.unlockWithPassword).not.toHaveBeenCalled();
    expect(phase()).toBe("success");
    act(() => vi.advanceTimersByTime(UNLOCK_EXIT_MS.glass + 50));
    expect(onDone).toHaveBeenCalled();
  });

  it("in anteprima mostra anche l'impronta, per farla vedere", () => {
    open({ demo: true, dismissible: true });
    expect(screen.getByRole("button", { name: "Sblocca con impronta/Face ID" })).toBeInTheDocument();
  });
});
