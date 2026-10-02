import { describe, expect, it } from "vitest";
import { mimeTypeOfFile } from "@/lib/file-mime";

describe("mimeTypeOfFile", () => {
  it("tiene il tipo dichiarato dal browser", () => {
    expect(mimeTypeOfFile({ name: "a.pdf", type: "application/pdf" })).toBe("application/pdf");
  });
  it("riconosce un .docx arrivato senza tipo", () => {
    expect(mimeTypeOfFile({ name: "Polizza.DOCX", type: "" })).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });
  it("per il resto ripiega sul tipo generico", () => {
    expect(mimeTypeOfFile({ name: "a.xyz", type: "" })).toBe("application/octet-stream");
  });
});
