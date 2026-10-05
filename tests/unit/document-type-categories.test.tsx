import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentTypeCategoriesPanel } from "@/components/settings/DocumentTypeCategoriesPanel";
import { defaultCategoryFor, type TypeCategoryOverrides } from "@/domain/ai/analysis/category-defaults";
import { extractedFieldsFrom } from "@/domain/ai/analyze-document";
import type { PersistedContentAnalysis } from "@/domain/ai/analysis/persisted";
import type { Category } from "@/domain/categories/types";

const CATEGORIES = [
  { id: "c-casa", name: "Casa" },
  { id: "c-util", name: "Utenze" },
  { id: "c-ass", name: "Assicurazioni" },
];

describe("defaultCategoryFor con le scelte dell'utente", () => {
  it("una scelta vince sulla corrispondenza predefinita", () => {
    expect(defaultCategoryFor("bolletta", CATEGORIES)).toMatchObject({ id: "c-casa" });
    expect(defaultCategoryFor("bolletta", CATEGORIES, { bolletta: "c-util" })).toMatchObject({ id: "c-util", name: "Utenze" });
  });

  it("null vuol dire nessuna categoria per quel tipo", () => {
    expect(defaultCategoryFor("bolletta", CATEGORIES, { bolletta: null })).toBeNull();
  });

  it("si può scegliere una categoria anche per un tipo senza corrispondenza predefinita", () => {
    expect(defaultCategoryFor("verbale", CATEGORIES)).toBeNull();
    expect(defaultCategoryFor("verbale", CATEGORIES, { verbale: "c-casa" })).toMatchObject({ id: "c-casa" });
  });

  it("una scelta su una categoria sparita ricade sulla predefinita; le scelte di altri tipi non c'entrano", () => {
    expect(defaultCategoryFor("bolletta", CATEGORIES, { bolletta: "c-eliminata" })).toMatchObject({ id: "c-casa" });
    expect(defaultCategoryFor("bolletta", CATEGORIES, { polizza: null })).toMatchObject({ id: "c-casa" });
  });
});

describe("la lettura salvata usa le scelte", () => {
  const analysis: PersistedContentAnalysis = {
    v: 1,
    fingerprint: "f",
    schemaVersion: 1,
    pipelineVersion: 4,
    models: { block: "b", merge: "m" },
    documentType: "bolletta",
    blocksTotal: 1,
    blocksTotalBeforeCap: 1,
    truncated: false,
    blocks: [{ expiry: [], issuer: [], category: null, fields: [], events: [], synthesis: null }],
    synthesis: null,
    mergeDone: true,
    updatedAt: "2026-10-05T00:00:00Z",
  };

  it("propone la categoria scelta dall'utente per il tipo", () => {
    expect(extractedFieldsFrom(analysis, CATEGORIES, { bolletta: "c-util" }).category).toMatchObject({
      derived: true,
      value: "c-util",
    });
  });

  it("non propone niente se l'utente ha scelto 'nessuna'", () => {
    expect(extractedFieldsFrom(analysis, CATEGORIES, { bolletta: null }).category).toBeNull();
  });
});

const repo = vi.hoisted(() => ({
  list: vi.fn(),
  set: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("@/domain/categories/type-categories", () => ({
  listTypeCategoryOverrides: repo.list,
  setTypeCategory: repo.set,
  resetTypeCategory: repo.reset,
}));
vi.mock("@/lib/db/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/auth/local-user", () => ({ getLocalUserId: async () => "user-1" }));

const PANEL_CATEGORIES: Category[] = [
  { id: "c-casa", name: "Casa", icon: "🏠", aiExtractionEnabled: false, aiExtractionEnabledUntil: null },
  { id: "c-util", name: "Utenze", icon: "💡", aiExtractionEnabled: false, aiExtractionEnabledUntil: null },
];

describe("DocumentTypeCategoriesPanel", () => {
  beforeEach(() => {
    repo.list.mockReset().mockResolvedValue({} as TypeCategoryOverrides);
    repo.set.mockReset().mockResolvedValue(undefined);
    repo.reset.mockReset().mockResolvedValue(undefined);
  });

  it("mostra un campo per tipo, con la corrispondenza predefinita", async () => {
    render(<DocumentTypeCategoriesPanel categories={PANEL_CATEGORIES} />);
    const bolletta = await screen.findByLabelText("Bolletta");
    expect(bolletta).toHaveValue("");
    expect(screen.getByRole("option", { name: "Predefinita: Casa" })).toBeInTheDocument();
    expect(screen.getByLabelText("Verbale o sanzione")).toHaveValue("");
    expect(screen.getAllByRole("option", { name: "Predefinita: nessuna" }).length).toBeGreaterThan(0);
  });

  it("riflette le scelte già salvate", async () => {
    repo.list.mockResolvedValue({ bolletta: "c-util", polizza: null });
    render(<DocumentTypeCategoriesPanel categories={PANEL_CATEGORIES} />);
    expect(await screen.findByLabelText("Bolletta")).toHaveValue("c-util");
    expect(screen.getByLabelText("Polizza assicurativa")).toHaveValue("none");
  });

  it("scegliere una categoria, 'nessuna' o la predefinita salva o toglie la scelta", async () => {
    render(<DocumentTypeCategoriesPanel categories={PANEL_CATEGORIES} />);
    const bolletta = await screen.findByLabelText("Bolletta");

    fireEvent.change(bolletta, { target: { value: "c-util" } });
    await waitFor(() => expect(repo.set).toHaveBeenCalledWith(expect.anything(), "user-1", "bolletta", "c-util"));
    await waitFor(() => expect(bolletta).toHaveValue("c-util"));

    fireEvent.change(bolletta, { target: { value: "none" } });
    await waitFor(() => expect(repo.set).toHaveBeenCalledWith(expect.anything(), "user-1", "bolletta", null));

    fireEvent.change(bolletta, { target: { value: "" } });
    await waitFor(() => expect(repo.reset).toHaveBeenCalledWith(expect.anything(), "bolletta"));
    await waitFor(() => expect(bolletta).toHaveValue(""));
  });

  it("se salvare fallisce, lo dice", async () => {
    repo.set.mockRejectedValue(new Error("Impossibile salvare la scelta: rete"));
    render(<DocumentTypeCategoriesPanel categories={PANEL_CATEGORIES} />);
    fireEvent.change(await screen.findByLabelText("Bolletta"), { target: { value: "c-casa" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Impossibile salvare la scelta");
  });
});
