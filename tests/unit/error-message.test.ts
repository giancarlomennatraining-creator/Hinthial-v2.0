import { describe, expect, it } from "vitest";
import { errorMessage } from "@/lib/utils";

describe("errorMessage", () => {
  it("usa il messaggio di un Error", () => {
    expect(errorMessage(new Error("Rete assente"), "Impossibile salvare.")).toBe("Rete assente");
  });

  it("per qualunque altro valore lanciato usa quello di riserva", () => {
    expect(errorMessage("testo", "Impossibile salvare.")).toBe("Impossibile salvare.");
    expect(errorMessage(null, "Impossibile salvare.")).toBe("Impossibile salvare.");
    expect(errorMessage({ message: "non è un Error" }, "Impossibile salvare.")).toBe("Impossibile salvare.");
  });
});
