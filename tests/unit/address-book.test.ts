import { describe, expect, it } from "vitest";
import { groupByLetter, letterOf, nameParts, sortAlphabetically } from "@/components/friends/AddressBook";

describe("letterOf", () => {
  it("è l'iniziale del nome, maiuscola e senza accenti", () => {
    expect(letterOf("Marta Rossi")).toBe("M");
    expect(letterOf("  davide costa")).toBe("D");
    expect(letterOf("Élodie")).toBe("E");
    expect(letterOf("Ànna")).toBe("A");
  });

  it("tutto ciò che non è una lettera va sotto #", () => {
    expect(letterOf("3M Italia")).toBe("#");
    expect(letterOf("")).toBe("#");
    expect(letterOf("😀 Smile")).toBe("#");
  });
});

describe("sortAlphabetically e groupByLetter", () => {
  const people = [{ name: "Marta Rossi" }, { name: "davide Costa" }, { name: "Àlex Verdi" }, { name: "Luca Bianchi" }, { name: "7 Eleven" }, { name: "Mario Neri" }];

  it("ordina come una rubrica, senza badare a maiuscole e accenti", () => {
    expect(sortAlphabetically(people).map((p) => p.name)).toEqual(["7 Eleven", "Àlex Verdi", "davide Costa", "Luca Bianchi", "Mario Neri", "Marta Rossi"]);
  });

  it("raggruppa per lettera, con # in fondo", () => {
    const groups = groupByLetter(people);
    expect(groups.map((g) => g.letter)).toEqual(["A", "D", "L", "M", "#"]);
    expect(groups.find((g) => g.letter === "M")?.people.map((p) => p.name)).toEqual(["Mario Neri", "Marta Rossi"]);
  });

  it("senza persone non ci sono gruppi", () => {
    expect(groupByLetter([])).toEqual([]);
  });

  it("non cambia l'elenco di partenza", () => {
    const copy = [...people];
    sortAlphabetically(people);
    expect(people).toEqual(copy);
  });
});

describe("nameParts", () => {
  it("usa nome e cognome salvati", () => {
    expect(nameParts({ name: "La mia amica Giulia", firstName: "Giulia", lastName: "Verdi" })).toEqual({ firstName: "Giulia", lastName: "Verdi" });
  });

  it("senza, li ricava dal nome visualizzato: la prima e l'ultima parola", () => {
    expect(nameParts({ name: "Marta Rossi", firstName: "", lastName: "" })).toEqual({ firstName: "Marta", lastName: "Rossi" });
    expect(nameParts({ name: "Anna Maria De Luca", firstName: "", lastName: "" })).toEqual({ firstName: "Anna", lastName: "Luca" });
    expect(nameParts({ name: "Notaio", firstName: "", lastName: "" })).toEqual({ firstName: "Notaio", lastName: "" });
    expect(nameParts({ name: "  ", firstName: "", lastName: "" })).toEqual({ firstName: "", lastName: "" });
  });
});
