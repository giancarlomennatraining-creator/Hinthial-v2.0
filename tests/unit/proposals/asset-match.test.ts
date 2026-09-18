/**
 * FASE 19b --- a quale bene si riferisce un documento.
 *
 * I casi che contano sono due, opposti: un identificativo (targa, IBAN,
 * numero di polizza) è una certezza e va riconosciuto anche scritto in
 * modo diverso; un nome generico ("Casa") è una trappola, perché
 * aggancerebbe qualunque documento che nomina una casa.
 */
import { describe, expect, it } from "vitest";
import { suggestAssetFromText } from "@/domain/proposals/asset-match";
import type { AssetListItem } from "@/domain/assets/types";

function asset(name: string, id = name): AssetListItem {
  return { id, name, categoryId: "cat-1", createdAt: "2026-01-01T00:00:00Z" };
}

describe("il bene si riconosce dagli identificativi", () => {
  it("riconosce una targa", () => {
    const found = suggestAssetFromText(
      "Polizza RC per il veicolo targato AB123CD, scadenza 2027",
      [asset("Fiat Panda AB123CD")],
    );
    expect(found?.name).toBe("Fiat Panda AB123CD");
  });

  it("riconosce una targa scritta con gli spazi", () => {
    const found = suggestAssetFromText("veicolo AB123CD", [asset("Fiat Panda AB 123 CD")]);
    expect(found?.name).toBe("Fiat Panda AB 123 CD");
  });

  it("riconosce un numero di polizza", () => {
    const found = suggestAssetFromText("Contratto n. 4471120039 del 2026", [
      asset("Polizza vita 4471120039"),
    ]);
    expect(found).not.toBeNull();
  });

  it("un identificativo batte un nome che somiglia", () => {
    const found = suggestAssetFromText("veicolo targato AB123CD", [
      asset("Appartamento via Manzoni 4", "casa"),
      asset("Fiat Panda AB123CD", "auto"),
    ]);
    expect(found?.id).toBe("auto");
  });
});

describe("il bene si riconosce anche dal nome, ma solo se è distintivo", () => {
  it("riconosce un nome lungo e specifico", () => {
    const found = suggestAssetFromText("Contratto di locazione appartamento via Manzoni 4", [
      asset("Appartamento via Manzoni 4"),
    ]);
    expect(found).not.toBeNull();
  });

  it.each(["Casa", "Auto", "Conto", "Moto"])("non aggancia niente su «%s»", (name) => {
    // Sono i nomi che la gente dà davvero ai propri beni, e sono anche
    // parole che compaiono ovunque.
    const text = "Contratto per la casa di famiglia, con auto e moto in garage, conto corrente";
    expect(suggestAssetFromText(text, [asset(name)])).toBeNull();
  });

  it("non basta una parola sola, per quanto lunga", () => {
    expect(suggestAssetFromText("Appartamento in centro", [asset("Appartamento")])).toBeNull();
  });
});

describe("quando non c'è niente da collegare", () => {
  it("un documento che non nomina nessun bene non ne aggancia nessuno", () => {
    const found = suggestAssetFromText("Referto di esame istologico", [
      asset("Fiat Panda AB123CD"),
      asset("Appartamento via Manzoni 4"),
    ]);
    expect(found).toBeNull();
  });

  it("senza testo o senza beni non lancia", () => {
    expect(suggestAssetFromText("", [asset("Fiat Panda AB123CD")])).toBeNull();
    expect(suggestAssetFromText("qualunque cosa", [])).toBeNull();
  });
});
