import { describe, expect, it } from "vitest";
import { formatDuration, recordingFilename } from "@/lib/media-recording";

describe("formatDuration", () => {
  it("formats seconds under a minute as 0:ss", () => {
    expect(formatDuration(7)).toBe("0:07");
  });

  it("formats minutes and seconds as m:ss", () => {
    expect(formatDuration(63)).toBe("1:03");
  });

  it("pads seconds but not minutes", () => {
    expect(formatDuration(720)).toBe("12:00");
  });

  it("formats zero as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
});

describe("recordingFilename", () => {
  const timestamp = new Date("2026-09-02T15:30:05.000Z").getTime();

  it("labels an audio recording distinctly from a video one", () => {
    expect(recordingFilename("audio", timestamp, "webm")).toMatch(/^messaggio-audio-/);
    expect(recordingFilename("video", timestamp, "webm")).toMatch(/^messaggio-video-/);
  });

  it("uses the given extension", () => {
    expect(recordingFilename("audio", timestamp, "ogg")).toMatch(/\.ogg$/);
  });

  it("produces a filesystem-safe name (no colons from the ISO timestamp)", () => {
    const filename = recordingFilename("audio", timestamp, "webm");
    expect(filename).not.toContain(":");
  });
});
