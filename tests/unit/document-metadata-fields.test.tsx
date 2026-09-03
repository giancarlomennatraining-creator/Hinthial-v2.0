import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentMetadataFields, EMPTY_METADATA_FIELDS } from "@/components/documents/DocumentMetadataFields";

describe("DocumentMetadataFields", () => {
  it("shows the Scadenza field by default (edit context)", () => {
    render(
      <DocumentMetadataFields
        idPrefix="edit"
        categories={[]}
        assets={[]}
        value={EMPTY_METADATA_FIELDS}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Scadenza")).toBeInTheDocument();
  });

  it("omits the Scadenza field when showExpiry is false (creation context)", () => {
    // Raramente si conosce già la scadenza esatta al momento della
    // creazione --- si aggiunge dopo, via "Modifica" (v. CreateArchiveItemForm).
    render(
      <DocumentMetadataFields
        idPrefix="upload"
        categories={[]}
        assets={[]}
        value={EMPTY_METADATA_FIELDS}
        onChange={vi.fn()}
        showExpiry={false}
      />,
    );
    expect(screen.queryByLabelText("Scadenza")).not.toBeInTheDocument();
  });

  it("still shows category/asset/tags/notes fields when the Scadenza field is hidden", () => {
    render(
      <DocumentMetadataFields
        idPrefix="upload"
        categories={[]}
        assets={[]}
        value={EMPTY_METADATA_FIELDS}
        onChange={vi.fn()}
        showExpiry={false}
      />,
    );
    expect(screen.getByLabelText("Categoria")).toBeInTheDocument();
    expect(screen.getByLabelText("Asset collegato")).toBeInTheDocument();
    expect(screen.getByLabelText("Tag (separati da virgola)")).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toBeInTheDocument();
  });
});
