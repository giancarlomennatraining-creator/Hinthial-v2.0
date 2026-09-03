import { describe, expect, it } from "vitest";
import { contentKindFor, hasInlinePlayer, NOTE_MIME_TYPE } from "@/lib/content-kind";

describe("contentKindFor", () => {
  it("recognizes the reserved note mimeType", () => {
    expect(contentKindFor(NOTE_MIME_TYPE)).toBe("note");
  });

  it("classifies image/audio/video mimeTypes by prefix", () => {
    expect(contentKindFor("image/jpeg")).toBe("image");
    expect(contentKindFor("audio/webm")).toBe("audio");
    expect(contentKindFor("video/mp4")).toBe("video");
  });

  it("falls back to 'document' for anything else, including plain text files", () => {
    expect(contentKindFor("application/pdf")).toBe("document");
    expect(contentKindFor("text/plain")).toBe("document");
    expect(contentKindFor("")).toBe("document");
  });
});

describe("hasInlinePlayer", () => {
  it("is true only for image/audio/video", () => {
    expect(hasInlinePlayer("image")).toBe(true);
    expect(hasInlinePlayer("audio")).toBe(true);
    expect(hasInlinePlayer("video")).toBe(true);
    expect(hasInlinePlayer("document")).toBe(false);
    expect(hasInlinePlayer("note")).toBe(false);
  });
});
