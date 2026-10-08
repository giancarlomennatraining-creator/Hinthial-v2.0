import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { UnlockPromptProvider, useUnlockPrompt } from "@/components/crypto/UnlockPromptProvider";
import { UnlockStyleSettings } from "@/components/settings/UnlockStyleSettings";
import { parseUnlockStyle, UNLOCK_STYLE_OPTIONS } from "@/lib/unlock-style";

const masterKey = { status: { kind: "locked" } as { kind: string } };
const showToast = vi.fn();
const updateUnlockStyle = vi.fn();

vi.mock("@/components/crypto/MasterKeyProvider", () => ({ useMasterKey: () => masterKey }));
vi.mock("@/components/crypto/SetupMasterKeyForm", () => ({ SetupMasterKeyForm: () => <div>setup</div> }));
vi.mock("@/components/ui/ToastProvider", () => ({ useToast: () => showToast }));
vi.mock("@/lib/db/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/domain/profile/repository", () => ({ updateUnlockStyle: (...args: unknown[]) => updateUnlockStyle(...args) }));
vi.mock("@/components/crypto/UnlockDialog", () => ({
  UnlockDialog: (props: { style: string; demo: boolean; dismissible: boolean; onDismiss: () => void; onDone: () => void }) => (
    <div role="dialog" data-style={props.style} data-demo={String(props.demo)} data-dismissible={String(props.dismissible)}>
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

function renderProvider(children: React.ReactNode, initialStyle: "glass" | "vault" | "fingerprint" = "glass") {
  return render(
    <UnlockPromptProvider userId="u1" initialStyle={initialStyle}>
      {children}
    </UnlockPromptProvider>,
  );
}

beforeEach(() => {
  masterKey.status = { kind: "locked" };
  showToast.mockReset();
  updateUnlockStyle.mockReset().mockResolvedValue(undefined);
});

describe("UnlockPromptProvider", () => {
  it("con il vault bloccato, chi la chiede apre la finestra nello stile scelto", () => {
    renderProvider(<Asker />, "vault");

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-style", "vault");
    expect(dialog).toHaveAttribute("data-demo", "false");
    expect(dialog).toHaveAttribute("data-dismissible", "false");
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
      <UnlockPromptProvider userId="u1" initialStyle="glass">
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
      <UnlockPromptProvider userId="u1" initialStyle="glass">
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
      <UnlockPromptProvider userId="u1" initialStyle="glass">
        <span />
      </UnlockPromptProvider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    const second = renderProvider(<Page dismissible={false} />);
    second.rerender(
      <UnlockPromptProvider userId="u1" initialStyle="glass">
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
      <UnlockPromptProvider userId="u1" initialStyle="glass">
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

describe("UnlockStyleSettings", () => {
  it("mostra le tre pelli con la loro spiegazione e segna quella scelta", () => {
    renderProvider(<UnlockStyleSettings />, "vault");

    for (const option of UNLOCK_STYLE_OPTIONS) {
      const radio = screen.getByRole("radio", { name: new RegExp(option.label) });
      expect(radio).toHaveTextContent(option.description);
      expect(radio).toHaveAttribute("aria-checked", String(option.value === "vault"));
    }
  });

  it("sceglierne un'altra la salva e la segna subito", async () => {
    renderProvider(<UnlockStyleSettings />);

    fireEvent.click(screen.getByRole("radio", { name: /Impronta/ }));
    expect(screen.getByRole("radio", { name: /Impronta/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Vetro/ })).toHaveAttribute("aria-checked", "false");
    await waitFor(() => expect(updateUnlockStyle).toHaveBeenCalledWith({}, "u1", "fingerprint"));
  });

  it("se il salvataggio fallisce torna alla scelta di prima e lo dice", async () => {
    updateUnlockStyle.mockRejectedValue(new Error("rete"));
    renderProvider(<UnlockStyleSettings />);

    fireEvent.click(screen.getByRole("radio", { name: /Cassaforte/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Preferenza non salvata."));
    expect(screen.getByRole("radio", { name: /Vetro/ })).toHaveAttribute("aria-checked", "true");
  });

  it("'Provala' apre un'anteprima, anche a vault sbloccato, che si chiude da sola", () => {
    masterKey.status = { kind: "unlocked" };
    renderProvider(<UnlockStyleSettings />);

    fireEvent.click(screen.getByRole("button", { name: "Prova lo stile Cassaforte" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-style", "vault");
    expect(dialog).toHaveAttribute("data-demo", "true");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "finito" }));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(showToast).not.toHaveBeenCalled(); // un'anteprima non dice "sbloccata"
    expect(updateUnlockStyle).not.toHaveBeenCalled(); // e non cambia la scelta
  });
});

describe("parseUnlockStyle", () => {
  it("accetta le tre pelli e ricade sul vetro per il resto", () => {
    expect(parseUnlockStyle("vault")).toBe("vault");
    expect(parseUnlockStyle("fingerprint")).toBe("fingerprint");
    expect(parseUnlockStyle("glass")).toBe("glass");
    expect(parseUnlockStyle("boh")).toBe("glass");
    expect(parseUnlockStyle(undefined)).toBe("glass");
  });
});
