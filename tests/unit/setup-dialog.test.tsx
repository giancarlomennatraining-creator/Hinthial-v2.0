import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetupDialog } from "@/components/crypto/SetupDialog";
import { SetupMasterKeyForm } from "@/components/crypto/SetupMasterKeyForm";
import { UNLOCK_EXIT_MS } from "@/lib/unlock-style";

const masterKey = {
  status: { kind: "not-set-up" } as { kind: string },
  setup: vi.fn(),
  confirmSetup: vi.fn(),
};
vi.mock("@/components/crypto/MasterKeyProvider", () => ({ useMasterKey: () => masterKey }));
vi.mock("qrcode", () => ({ default: { toDataURL: () => Promise.resolve("data:image/png;base64,AAAA") } }));

const noop = () => {};

beforeEach(() => {
  masterKey.status = { kind: "not-set-up" };
  masterKey.setup.mockReset().mockResolvedValue({
    setup: { recoveryKey: { formatted: "ABCD-EFGH-IJKL" } },
    masterKey: {},
  });
  masterKey.confirmSetup.mockReset().mockResolvedValue(undefined);
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as never;
});

afterEach(() => vi.useRealTimers());

function fillStepOne(password = "una-master-password", confirm = password) {
  fireEvent.change(screen.getByLabelText("Master password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Conferma master password"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Crea" }));
}

describe("SetupMasterKeyForm", () => {
  it("al primo passo chiede password e conferma, e rifiuta password corte o diverse", async () => {
    render(<SetupMasterKeyForm />);
    expect(screen.getByRole("heading", { name: "Configura la cifratura" })).toBeInTheDocument();
    expect(screen.getByText("Passo 1 di 2")).toBeInTheDocument();

    fillStepOne("corta");
    expect(screen.getByRole("alert")).toHaveTextContent("almeno 8 caratteri");
    fillStepOne("una-master-password", "un-altra-master-password");
    expect(screen.getByRole("alert")).toHaveTextContent("non coincidono");
    expect(masterKey.setup).not.toHaveBeenCalled();
  });

  it("col secondo passo mostra la recovery key, e 'Continua' si abilita solo dopo aver detto di averla salvata", async () => {
    const states: { step: number; busy: boolean }[] = [];
    render(<SetupMasterKeyForm onStateChange={(s) => states.push(s)} />);

    fillStepOne();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Salva la tua recovery key" })).toBeInTheDocument());
    expect(masterKey.setup).toHaveBeenCalledWith("una-master-password");
    expect(screen.getAllByText("ABCD-EFGH-IJKL")).toHaveLength(2); // a schermo e nel kit stampabile
    expect(screen.getByText("Passo 2 di 2")).toBeInTheDocument();
    expect(states.some((s) => s.step === 2)).toBe(true);

    const next = screen.getByRole("button", { name: "Continua" });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Ho salvato la recovery key in un posto sicuro."));
    expect(next).toBeEnabled();
    fireEvent.click(next);
    await waitFor(() => expect(masterKey.confirmSetup).toHaveBeenCalledTimes(1));
  });

  it("il kit stampabile sta fuori dalla finestra, direttamente nel body", async () => {
    render(<SetupMasterKeyForm />);
    fillStepOne();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Salva la tua recovery key" })).toBeInTheDocument());

    const printKit = document.body.querySelector(":scope > .print-only");
    expect(printKit).not.toBeNull();
    expect(printKit).toHaveTextContent("Kit di recovery");
    expect(printKit).toHaveTextContent("ABCD-EFGH-IJKL");
  });
});

describe("SetupDialog", () => {
  it("è una finestra con la cornice della pelle scelta", () => {
    render(<SetupDialog style="vault" dismissible={false} onDismiss={noop} onDone={noop} />);

    expect(screen.getByRole("dialog", { name: "Crea la master password" })).toBeInTheDocument();
    expect(document.querySelector(".unlock-vault-wrap")).not.toBeNull();
    expect(document.querySelector(".unlock-wide")).not.toBeNull();
  });

  it("chiudibile solo al primo passo: davanti alla recovery key appena generata non si può chiudere", async () => {
    const onDismiss = vi.fn();
    render(<SetupDialog style="glass" dismissible onDismiss={onDismiss} onDone={noop} />);

    fireEvent.click(screen.getByRole("button", { name: "Più tardi" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    fillStepOne();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Salva la tua recovery key" })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("button", { name: "Più tardi" })).not.toBeInTheDocument());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("non chiudibile (la pagina ne ha bisogno): nessun 'Più tardi'", () => {
    render(<SetupDialog style="glass" dismissible={false} onDismiss={noop} onDone={noop} />);
    expect(screen.queryByRole("button", { name: "Più tardi" })).not.toBeInTheDocument();
  });

  it("a creazione finita (vault sbloccato) fa l'animazione di uscita e si chiude", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { rerender } = render(<SetupDialog style="glass" dismissible={false} onDismiss={noop} onDone={onDone} />);
    expect(document.querySelector("[data-phase]")?.getAttribute("data-phase")).toBe("idle");

    masterKey.status = { kind: "unlocked" };
    rerender(<SetupDialog style="glass" dismissible={false} onDismiss={noop} onDone={onDone} />);
    expect(document.querySelector("[data-phase]")?.getAttribute("data-phase")).toBe("success");
    act(() => vi.advanceTimersByTime(UNLOCK_EXIT_MS.glass - 50));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
