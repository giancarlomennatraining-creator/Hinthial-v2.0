import { describe, expect, it } from "vitest";
import { stubTranscriptionProvider } from "@/domain/transcription/stub-provider";

describe("stubTranscriptionProvider", () => {
  it("never processes the given audio --- always resolves to null, regardless of input", async () => {
    await expect(
      stubTranscriptionProvider.transcribe(new Uint8Array([1, 2, 3]), "audio/webm"),
    ).resolves.toBeNull();
    await expect(stubTranscriptionProvider.transcribe(new Uint8Array(), "video/mp4")).resolves.toBeNull();
  });
});
