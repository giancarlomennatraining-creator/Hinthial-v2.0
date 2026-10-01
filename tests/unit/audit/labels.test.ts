import { describe, expect, it } from "vitest";
import {
  AUDIT_EVENT_CATEGORIES,
  AUDIT_EVENT_TYPE_CATEGORY,
  AUDIT_EVENT_TYPE_ICON,
  AUDIT_EVENT_TYPE_LABEL,
  auditEventTypesOf,
  describeAuditEvent,
} from "@/domain/audit/labels";

describe("mappe degli eventi", () => {
  it("etichetta, icona e area coprono gli stessi tipi", () => {
    const labels = Object.keys(AUDIT_EVENT_TYPE_LABEL).sort();
    expect(Object.keys(AUDIT_EVENT_TYPE_ICON).sort()).toEqual(labels);
    expect(Object.keys(AUDIT_EVENT_TYPE_CATEGORY).sort()).toEqual(labels);
  });

  it("ogni area ha almeno un tipo, e i tipi di un'area le appartengono", () => {
    for (const area of AUDIT_EVENT_CATEGORIES) {
      const types = auditEventTypesOf(area);
      expect(types.length).toBeGreaterThan(0);
      for (const type of types) expect(AUDIT_EVENT_TYPE_CATEGORY[type]).toBe(area);
    }
  });
});

describe("describeAuditEvent", () => {
  it("distingue letto da riletto", () => {
    expect(describeAuditEvent({ type: "ai_extraction_used", metadata: null }).label).toBe("Documento letto da Hinthia");
    expect(describeAuditEvent({ type: "ai_extraction_used", metadata: { reread: true } }).label).toBe(
      "Documento riletto da Hinthia",
    );
  });

  it("indica quale proposta: scadenza, categoria, emittente", () => {
    expect(describeAuditEvent({ type: "proposal_accepted", metadata: { proposalKind: "expiry" } })).toEqual({
      label: "Proposta accettata",
      detail: "Scadenza",
    });
    expect(describeAuditEvent({ type: "proposal_rejected", metadata: { proposalKind: "category" } }).detail).toBe(
      "Categoria",
    );
    expect(describeAuditEvent({ type: "proposal_undone", metadata: { proposalKind: "issuer" } }).detail).toBe(
      "Emittente",
    );
  });

  it("per un campo libero usa l'etichetta del vocabolario, o la chiave se manca", () => {
    const metadata = { proposalKind: "field" as const, fieldKey: "targa" };
    expect(describeAuditEvent({ type: "proposal_accepted", metadata }, { targa: "Targa" }).detail).toBe("Targa");
    expect(describeAuditEvent({ type: "proposal_accepted", metadata }).detail).toBe("targa");
  });

  it("distingue il testo letto dal testo riletto sul dispositivo", () => {
    expect(describeAuditEvent({ type: "document_text_read", metadata: { reread: false } }).label).toBe(
      "Testo letto sul dispositivo",
    );
    expect(describeAuditEvent({ type: "document_text_read", metadata: { reread: true } }).label).toBe(
      "Testo riletto sul dispositivo",
    );
  });

  it("indica quale salvataggio è stato fatto", () => {
    expect(describeAuditEvent({ type: "document_updated", metadata: { change: "transcript" } })).toEqual({
      label: "Contenuto modificato",
      detail: "Trascrizione",
    });
    expect(describeAuditEvent({ type: "document_updated", metadata: { change: "ai_reading" } }).detail).toBe(
      "Lettura di Hinthia salvata",
    );
    expect(
      describeAuditEvent({ type: "document_updated", metadata: { change: "ai_exclusion", excluded: true } }).detail,
    ).toBe("Esclusione da Hinthia: escluso");
    expect(describeAuditEvent({ type: "document_updated", metadata: null }).detail).toBeNull();
  });

  it("senza metadati resta l'etichetta generica", () => {
    expect(describeAuditEvent({ type: "proposal_accepted", metadata: null })).toEqual({
      label: "Proposta accettata",
      detail: null,
    });
  });
});
