import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { UnlockPromptProvider, useUnlockPrompt } from "@/components/crypto/UnlockPromptProvider";
import { unlockStyleFor } from "@/lib/unlock-style";

const masterKey = { status: { kind: "locked" } as { kind: string }, lock: vi.fn(), deviceLockAvailable: false };
const showToast = vi.fn();

vi.mock("@/components/crypto/MasterKeyProvider", () => ({ useMasterKey: () => masterKey }));
vi.mock("@/components/crypto/SetupDialog", () => ({
  SetupDialog: (props: { style: string; dismissible: boolean; onDismiss: () => void; onDone: () => void }) => (
    <div role="dialog" aria-label="Crea" data-style={props.style} data-dismissible={String(props.dismissible)}>
      <button onClick={props.onDismiss}>chiudi</button>
      <button onClick={props.onDone}>finito</button>
    </div>
  ),
}));
vi.mock("@/components/ui/ToastProvider", () => ({ useToast: () => showToast }));
vi.mock("@/components/crypto/UnlockDialog", () => ({
  UnlockDialog: (props: { style: string; dismissible: boolean; leaveHref?: string; onDismiss: () => void; onDone: () => void }) => (
    <div role="dialog" data-style={props.style} data-dismissible={String(props.dismissible)} data-leave={props.leaveHref ?? ""}>
      <button onClick={props.onDismiss}>chiudi</button>
      <button onClick={props.onDone}>finito</button>
    </div>
  ),
}));

function Asker({ dismissible, onDismiss }: { dismissible?: boolean; onDismiss?: () => void }) {
  const { requestUnlock } = useUnlockPrompt();
  useEffect(() => {
    requestUnlock({ dismissible, onDismiss });
  }, [requestUnlock, dismissible, onDismiss]);
  return null;
}

function renderProvider(children: React.ReactNode) {
  return render(<UnlockPromptProvider>{children}</UnlockPromptProvider>);
}

beforeEach(() => {
  masterKey.status = { kind: "locked" };
  masterKey.lock.mockReset();
  masterKey.deviceLockAvailable = false;
  sessionStorage.clear();
  showToast.mockReset();
});

describe("UnlockPromptProvider", () => {
  it("con il vault bloccato, chi la chiede apre la finestra: il vetro su un dispositivo non fidato", () => {
    renderProvider(<Asker />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-style", "glass");
    expect(dialog).toHaveAttribute("data-dismissible", "false");
  });

  it("su un dispositivo fidato la finestra è quella dell'impronta", () => {
    masterKey.deviceLockAvailable = true;
    renderProvider(<Asker />);

    expect(screen.getByRole("dialog")).toHaveAttribute("data-style", "fingerprint");
  });

  it("con il vault già sbloccato o ancora da creare non si apre nulla", () => {
    masterKey.status = { kind: "unlocked" };
    const { unmount } = renderProvider(<Asker />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    masterKey.status = { kind: "not-set-up" };
    renderProvider(<Asker />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("chiudibile, avvisa chi l'ha chiesta quando la si chiude; non mostra il messaggio di sblocco", () => {
    const onDismiss = vi.fn();
    renderProvider(<Asker dismissible onDismiss={onDismiss} />);

    expect(screen.getByRole("dialog")).toHaveAttribute("data-dismissible", "true");
    fireEvent.click(screen.getByRole("button", { name: "chiudi" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("un tocco su 'chiudi' arrivato dopo che la finestra è diventata non chiudibile non la chiude", () => {
    const { rerender } = renderProvider(<Asker dismissible />);
    const close = screen.getByRole("button", { name: "chiudi" }); // il pulsante com'era prima dell'aggiornamento

    rerender(
      <UnlockPromptProvider>
        <Asker dismissible />
        <Asker />
      </UnlockPromptProvider>,
    );
    fireEvent.click(close);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-dismissible", "false");
  });

  it("a sblocco finito si chiude e dice 'Cassaforte sbloccata.'", () => {
    renderProvider(<Asker />);

    fireEvent.click(screen.getByRole("button", { name: "finito" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Cassaforte sbloccata.");
  });

  it("una pagina che serve la chiave rende non chiudibile una finestra aperta come chiudibile", () => {
    const { rerender } = renderProvider(<Asker dismissible />);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-dismissible", "true");

    rerender(
      <UnlockPromptProvider>
        <Asker dismissible />
        <Asker />
      </UnlockPromptProvider>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("data-dismissible", "false");
  });

  it("chi l'aveva aperta chiudibile la ritira uscendo di scena; una non chiudibile resta", () => {
    function Page({ dismissible }: { dismissible: boolean }) {
      const { requestUnlock, releaseUnlock } = useUnlockPrompt();
      useEffect(() => {
        requestUnlock({ dismissible });
      }, [requestUnlock, dismissible]);
      useEffect(() => () => releaseUnlock(), [releaseUnlock]);
      return null;
    }

    const first = renderProvider(<Page dismissible />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    first.rerender(
      <UnlockPromptProvider>
        <span />
      </UnlockPromptProvider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    const second = renderProvider(<Page dismissible={false} />);
    second.rerender(
      <UnlockPromptProvider>
        <span />
      </UnlockPromptProvider>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("due richieste insieme aprono una sola finestra", () => {
    renderProvider(
      <>
        <Asker />
        <Asker dismissible />
      </>,
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-dismissible", "false"); // vince la prima
  });
});

describe("creazione della master password e blocco a mano", () => {
  function Setupper({ dismissible }: { dismissible?: boolean }) {
    const { requestSetup } = useUnlockPrompt();
    useEffect(() => {
      requestSetup({ dismissible });
    }, [requestSetup, dismissible]);
    return null;
  }

  it("se la master password non c'è ancora, 'requestSetup' apre la finestra di creazione nella pelle del dispositivo", () => {
    masterKey.status = { kind: "not-set-up" };
    masterKey.deviceLockAvailable = true;
    renderProvider(<Setupper dismissible />);

    const dialog = screen.getByRole("dialog", { name: "Crea" });
    expect(dialog).toHaveAttribute("data-style", "fingerprint");
    expect(dialog).toHaveAttribute("data-dismissible", "true");
  });

  it("con la master password già creata, 'requestSetup' non fa nulla; e 'requestUnlock' non apre la creazione", () => {
    renderProvider(<Setupper />); // vault bloccato = già creato
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a creazione finita dice 'Master password creata.'", () => {
    masterKey.status = { kind: "not-set-up" };
    renderProvider(<Setupper />);

    fireEvent.click(screen.getByRole("button", { name: "finito" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Master password creata.");
  });

  it("una pagina che serve la chiave, a master password non creata, apre la creazione e non si può chiudere", () => {
    masterKey.status = { kind: "not-set-up" };
    renderProvider(<RequireMasterKey>{() => <p>contenuto vero</p>}</RequireMasterKey>);

    expect(screen.getByRole("dialog", { name: "Crea" })).toHaveAttribute("data-dismissible", "false");
    expect(screen.queryByText("contenuto vero")).not.toBeInTheDocument();
  });

  it("'lockNow' blocca la cassaforte, dice che è bloccata e riabilita la finestra chiusa con 'Più tardi'", () => {
    masterKey.status = { kind: "unlocked", masterKey: {} } as never;
    sessionStorage.setItem("hinthial.unlock-dismissed", "1");
    function Locker() {
      const { lockNow } = useUnlockPrompt();
      return <button onClick={lockNow}>blocca</button>;
    }
    renderProvider(<Locker />);

    fireEvent.click(screen.getByRole("button", { name: "blocca" }));
    expect(masterKey.lock).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith("Hinthial bloccato.");
    expect(sessionStorage.getItem("hinthial.unlock-dismissed")).toBeNull();
  });
});

describe("RequireMasterKey: a pagina intera o in una sezione", () => {
  it("a pagina intera la finestra si apre da sola, non si chiude e offre di tornare alla dashboard", () => {
    renderProvider(<RequireMasterKey>{() => <p>contenuto vero</p>}</RequireMasterKey>);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-dismissible", "false");
    expect(dialog).toHaveAttribute("data-leave", "/dashboard");
  });

  it("lasciando la pagina la finestra si ritira e non resta sopra un'altra", () => {
    const { rerender } = renderProvider(<RequireMasterKey>{() => <p>contenuto vero</p>}</RequireMasterKey>);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(
      <UnlockPromptProvider>
        <p>un altra pagina</p>
      </UnlockPromptProvider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("in una sezione (inline) non si apre niente da solo: un riquadro con il pulsante per sbloccare, chiudibile", () => {
    renderProvider(<RequireMasterKey inline>{() => <p>contenuto vero</p>}</RequireMasterKey>);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/La cassaforte è bloccata/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sblocca ora" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-dismissible", "true");
    expect(dialog).toHaveAttribute("data-leave", "");
  });

  it("in una sezione, a master password non creata, il pulsante apre la creazione", () => {
    masterKey.status = { kind: "not-set-up" };
    renderProvider(<RequireMasterKey inline>{() => <p>contenuto vero</p>}</RequireMasterKey>);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crea la master password" }));
    expect(screen.getByRole("dialog", { name: "Crea" })).toHaveAttribute("data-dismissible", "true");
  });

  it("il popup di benvenuto non sta sopra la finestra di creazione", () => {
    // Il suo comportamento è provato in e2e (master-key-intro); qui basta che il provider lo dica.
    masterKey.status = { kind: "not-set-up" };
    function Probe() {
      return useUnlockPrompt().setupOpen ? <p>la creazione è aperta</p> : null;
    }
    renderProvider(
      <>
        <Probe />
        <RequireMasterKey>{() => <p>contenuto vero</p>}</RequireMasterKey>
      </>,
    );
    expect(screen.getByText("la creazione è aperta")).toBeInTheDocument();
  });
});

describe("la pagina si popola dopo l'animazione di sblocco", () => {
  function Page() {
    return <RequireMasterKey>{() => <p>contenuto vero</p>}</RequireMasterKey>;
  }

  it("a vault bloccato la pagina è uno scheletro e la finestra è aperta", () => {
    renderProvider(<Page />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("contenuto vero")).not.toBeInTheDocument();
    expect(screen.getByText("La cassaforte è bloccata.")).toBeInTheDocument();
  });

  it("appena sbloccato, finché la finestra si dissolve, il contenuto non c'è ancora; compare quando la finestra è sparita", () => {
    const { rerender } = renderProvider(<Page />);

    // Il vault risulta sbloccato mentre la finestra sta ancora animando l'uscita.
    masterKey.status = { kind: "unlocked", masterKey: {} } as never;
    rerender(
      <UnlockPromptProvider>
        <Page />
      </UnlockPromptProvider>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("contenuto vero")).not.toBeInTheDocument();

    // L'animazione finisce: la finestra si chiude e la pagina si popola.
    fireEvent.click(screen.getByRole("button", { name: "finito" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("contenuto vero")).toBeInTheDocument();
  });

  it("già sbloccato, senza finestra aperta, il contenuto c'è subito", () => {
    masterKey.status = { kind: "unlocked", masterKey: {} } as never;
    renderProvider(<Page />);

    expect(screen.getByText("contenuto vero")).toBeInTheDocument();
  });
});

describe("unlockStyleFor", () => {
  it("l'impronta se il dispositivo è fidato, il vetro altrimenti", () => {
    expect(unlockStyleFor(true)).toBe("fingerprint");
    expect(unlockStyleFor(false)).toBe("glass");
  });
});
