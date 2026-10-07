import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThumbnailProvider, useThumbnail } from "@/components/documents/archive/thumbnails";
import type { DocumentSummary } from "@/domain/documents/types";

const downloadThumbnail = vi.fn();

vi.mock("@/domain/documents/repository", () => ({
  downloadThumbnail: (...args: unknown[]) => downloadThumbnail(...args),
}));

function Probe({ doc }: { doc: DocumentSummary }) {
  const { url, ref } = useThumbnail(doc);
  return <div ref={ref}>{url ?? "nessuna miniatura"}</div>;
}

const doc = { id: "d1", storagePath: "u/d1.json", hasThumbnail: true } as DocumentSummary;

beforeEach(() => {
  downloadThumbnail.mockReset().mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));
  URL.createObjectURL = vi.fn(() => "blob:miniatura");
  URL.revokeObjectURL = vi.fn();
});

describe("miniature (useThumbnail)", () => {
  it("arrivano anche in modalità Strict Mode, dove React monta, smonta e rimonta ogni componente", async () => {
    render(
      <StrictMode>
        <ThumbnailProvider data={{ supabase: {} as never, masterKey: {} as CryptoKey }}>
          <Probe doc={doc} />
        </ThumbnailProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText("blob:miniatura")).toBeInTheDocument());
  });

  it("senza miniatura non scarica nulla", async () => {
    render(
      <ThumbnailProvider data={{ supabase: {} as never, masterKey: {} as CryptoKey }}>
        <Probe doc={{ ...doc, hasThumbnail: false }} />
      </ThumbnailProvider>,
    );

    expect(screen.getByText("nessuna miniatura")).toBeInTheDocument();
    expect(downloadThumbnail).not.toHaveBeenCalled();
  });
});
