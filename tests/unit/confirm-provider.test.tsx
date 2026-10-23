// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfirmProvider, useConfirm, type ConfirmOptions } from "@/components/ui/ConfirmProvider";

afterEach(cleanup);

function Harness({ options, onAnswer }: { options: ConfirmOptions | string; onAnswer: (answer: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={async () => onAnswer(await confirm(options))}>
      Apri
    </button>
  );
}

function setup(options: ConfirmOptions | string) {
  const answers: boolean[] = [];
  render(
    <ConfirmProvider>
      <Harness options={options} onAnswer={(a) => answers.push(a)} />
    </ConfirmProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Apri" }));
  return answers;
}

describe("ConfirmProvider", () => {
  it("mostra la domanda con il verbo dell'azione e risponde sì", async () => {
    const answers = setup({ message: "Eliminare il bene?", confirmLabel: "Elimina", danger: true });
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Eliminare il bene?");
    expect(dialog).toHaveTextContent("Sei sicuro?");
    fireEvent.click(screen.getByRole("button", { name: "Elimina" }));
    await waitFor(() => expect(answers).toEqual([true]));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Annulla e Esc rispondono no", async () => {
    const answers = setup({ message: "Procedere?" });
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    await waitFor(() => expect(answers).toEqual([false]));

    fireEvent.click(screen.getByRole("button", { name: "Apri" }));
    await screen.findByRole("alertdialog");
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    await waitFor(() => expect(answers).toEqual([false, false]));
  });

  it("un'azione che non si disfa parte con il fuoco su Annulla, le altre su Conferma", async () => {
    setup({ message: "Eliminare?", danger: true });
    await screen.findByRole("alertdialog");
    expect(screen.getByRole("button", { name: "Annulla" })).toHaveFocus();
    cleanup();

    setup({ message: "Attivare?", confirmLabel: "Attiva" });
    await screen.findByRole("alertdialog");
    expect(screen.getByRole("button", { name: "Attiva" })).toHaveFocus();
  });

  it("accetta anche solo un testo, e rispetta le righe a capo", async () => {
    setup("Una riga\nun'altra");
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Conferma");
    expect(dialog).toHaveTextContent("Una riga");
  });

  it("senza il provider avvisa di cosa manca", () => {
    function Bare() {
      useConfirm();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/ConfirmProvider/);
  });
});
