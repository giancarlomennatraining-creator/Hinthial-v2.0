import { describe, expect, it } from "vitest";
import {
  EMPTY_AUDIT_FILTERS,
  auditFiltersToParams,
  auditFiltersToQuery,
  countActiveAuditFilters,
  effectiveAuditTypes,
  lastDaysRange,
  parseAuditFilters,
  typesWithinArea,
} from "@/domain/audit/filters";
import { auditEventTypesOf } from "@/domain/audit/labels";

const ID = "3f2b8c1e-6d4a-4b7e-9a10-2c5d8e7f1a90";

describe("parseAuditFilters", () => {
  it("senza parametri dà i filtri di partenza", () => {
    expect(parseAuditFilters({})).toEqual(EMPTY_AUDIT_FILTERS);
  });

  it("legge periodo, area, tipi, elemento, righe e pagina", () => {
    const filters = parseAuditFilters({
      from: "2026-09-01",
      to: "2026-09-30",
      area: "archive",
      types: "document_created,document_updated",
      entity: `document:${ID}`,
      size: "50",
      page: "3",
    });
    expect(filters).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      area: "archive",
      types: ["document_created", "document_updated"],
      entity: { type: "document", id: ID },
      pageSize: 50,
      page: 3,
    });
  });

  it("scarta ciò che non è valido invece di rompersi", () => {
    const filters = parseAuditFilters({
      from: "ieri",
      to: "2026-13-45",
      area: "boh",
      types: "document_created,toString,inventato",
      entity: "document:non-un-uuid",
      size: "7",
      page: "-2",
    });
    expect(filters).toEqual({ ...EMPTY_AUDIT_FILTERS, types: ["document_created"] });
  });

  it("rifiuta un tipo di elemento che non esiste", () => {
    expect(parseAuditFilters({ entity: `toString:${ID}` }).entity).toBeNull();
  });

  it("tratta come assente un parametro ripetuto", () => {
    const repeated = { from: ["2026-09-01", "2026-09-02"] } as unknown as Parameters<typeof parseAuditFilters>[0];
    expect(parseAuditFilters(repeated).from).toBe("");
  });
});

describe("auditFiltersToParams", () => {
  it("un elenco senza filtri ha un URL pulito", () => {
    expect(auditFiltersToParams(EMPTY_AUDIT_FILTERS).toString()).toBe("");
  });

  it("scrive e rilegge gli stessi filtri", () => {
    const filters = {
      from: "2026-09-01",
      to: "",
      area: "assets" as const,
      types: ["asset_created" as const],
      entity: { type: "asset" as const, id: ID },
      pageSize: 100 as const,
      page: 2,
    };
    const params = Object.fromEntries(auditFiltersToParams(filters));
    expect(parseAuditFilters(params)).toEqual(filters);
  });
});

describe("tipi da cercare", () => {
  it("i tipi scelti prevalgono sull'area", () => {
    expect(effectiveAuditTypes({ area: "archive", types: ["login"] })).toEqual(["login"]);
  });

  it("senza tipi scelti valgono tutti quelli dell'area", () => {
    expect(effectiveAuditTypes({ area: "capsules", types: [] })).toEqual(auditEventTypesOf("capsules"));
  });

  it("senza area né tipi non c'è vincolo", () => {
    expect(effectiveAuditTypes({ area: null, types: [] })).toEqual([]);
  });

  it("cambiando area cadono i tipi che non le appartengono", () => {
    expect(typesWithinArea(["login", "document_created"], "archive")).toEqual(["document_created"]);
    expect(typesWithinArea(["login", "document_created"], null)).toEqual(["login", "document_created"]);
  });
});

describe("auditFiltersToQuery e conteggio", () => {
  it("traduce date vuote in null e porta pagina e righe", () => {
    const query = auditFiltersToQuery({ ...EMPTY_AUDIT_FILTERS, from: "2026-09-01", page: 2, pageSize: 50 });
    expect(query).toMatchObject({ startDate: "2026-09-01", endDate: null, types: [], entity: null, page: 2, pageSize: 50 });
  });

  it("il periodo conta come un solo filtro, righe e pagina non contano", () => {
    expect(countActiveAuditFilters({ ...EMPTY_AUDIT_FILTERS, from: "2026-09-01", to: "2026-09-30" })).toBe(1);
    expect(countActiveAuditFilters({ ...EMPTY_AUDIT_FILTERS, pageSize: 100, page: 4 })).toBe(0);
    expect(
      countActiveAuditFilters({
        ...EMPTY_AUDIT_FILTERS,
        area: "friends",
        types: ["friend_added", "friend_deleted"],
        entity: { type: "friend", id: ID },
      }),
    ).toBe(4);
  });
});

describe("lastDaysRange", () => {
  it("gli ultimi 7 giorni includono oggi", () => {
    expect(lastDaysRange(7, new Date(2026, 9, 10))).toEqual({ from: "2026-10-04", to: "2026-10-10" });
  });

  it("attraversa il cambio di mese", () => {
    expect(lastDaysRange(30, new Date(2026, 9, 10))).toEqual({ from: "2026-09-11", to: "2026-10-10" });
  });
});
