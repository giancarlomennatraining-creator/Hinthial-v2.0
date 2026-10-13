import { describe, expect, it } from "vitest";
import { onePerSlot } from "@/domain/proposals/for-document";
import type { Proposal } from "@/domain/proposals/types";

const p = (over: Partial<Proposal> & Pick<Proposal, "kind" | "value">): Proposal => ({ source: "testo", ...over });

describe("onePerSlot", () => {
  it("tiene la prima proposta per tipo", () => {
    const result = onePerSlot([
      p({ kind: "expiry", value: "2027-01-01" }),
      p({ kind: "expiry", value: "2028-01-01" }),
      p({ kind: "issuer", value: "ENEL" }),
    ]);
    expect(result.map((x) => x.value)).toEqual(["2027-01-01", "ENEL"]);
  });

  it("per i campi distingue per chiave", () => {
    const result = onePerSlot([
      p({ kind: "field", value: "AB123CD", fieldKey: "targa" }),
      p({ kind: "field", value: "PL-9", fieldKey: "numero_polizza" }),
      p({ kind: "field", value: "ZZ", fieldKey: "targa" }),
    ]);
    expect(result.map((x) => x.value)).toEqual(["AB123CD", "PL-9"]);
  });

  it("lascia fuori gli eventi e il collegamento a un bene: si confermano a parte", () => {
    const result = onePerSlot([
      p({ kind: "event", value: "2026-06-30", eventTitle: "Rogito" }),
      p({ kind: "asset", value: "id-bene" }),
      p({ kind: "category", value: "cat1" }),
    ]);
    expect(result.map((x) => x.kind)).toEqual(["category"]);
  });
});
