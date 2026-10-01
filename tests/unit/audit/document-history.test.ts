import { describe, expect, it } from "vitest";
import { summarizeDocumentHistory } from "@/domain/audit/document-history";
import { describeAuditEvent } from "@/domain/audit/labels";
import type { AuditEventListItem } from "@/domain/audit/types";

function event(id: string, type: AuditEventListItem["type"], at: string): AuditEventListItem {
  return { id, type, createdAt: at, metadata: null };
}

describe("summarizeDocumentHistory", () => {
  it("unisce le letture di Hinthia ravvicinate in una riga sola", () => {
    const rows = [
      event("4", "ai_extraction_used", "2026-10-01T10:02:00Z"),
      event("3", "ai_extraction_used", "2026-10-01T10:01:00Z"),
      event("2", "ai_extraction_used", "2026-10-01T10:00:00Z"),
      event("1", "document_created", "2026-10-01T09:00:00Z"),
    ];
    expect(summarizeDocumentHistory(rows, 10).map((e) => e.id)).toEqual(["4", "1"]);
  });

  it("tiene separate due letture lontane nel tempo", () => {
    const rows = [
      event("2", "ai_extraction_used", "2026-10-02T10:00:00Z"),
      event("1", "ai_extraction_used", "2026-10-01T10:00:00Z"),
    ];
    expect(summarizeDocumentHistory(rows, 10)).toHaveLength(2);
  });

  it("non unisce letture separate da un'altra azione", () => {
    const rows = [
      event("3", "ai_extraction_used", "2026-10-01T10:03:00Z"),
      event("2", "proposal_accepted", "2026-10-01T10:02:00Z"),
      event("1", "ai_extraction_used", "2026-10-01T10:01:00Z"),
    ];
    expect(summarizeDocumentHistory(rows, 10)).toHaveLength(3);
  });

  it("non unisce una prima lettura e una rilettura", () => {
    const rows: AuditEventListItem[] = [
      { ...event("2", "ai_extraction_used", "2026-10-01T10:05:00Z"), metadata: { reread: true } },
      event("1", "ai_extraction_used", "2026-10-01T10:00:00Z"),
    ];
    expect(summarizeDocumentHistory(rows, 10)).toHaveLength(2);
  });

  it("limita il numero di righe", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      event(String(i), "document_updated", `2026-10-01T10:${String(59 - i).padStart(2, "0")}:00Z`),
    );
    expect(summarizeDocumentHistory(rows, 8)).toHaveLength(8);
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

  it("senza metadati (eventi vecchi) resta l'etichetta generica", () => {
    expect(describeAuditEvent({ type: "proposal_accepted", metadata: null })).toEqual({
      label: "Proposta accettata",
      detail: null,
    });
  });
});
