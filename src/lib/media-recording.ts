/**
 * Pure helpers for the capsule audio/video recorder
 * (components/capsules/AudioVideoRecorder.tsx) --- kept separate from
 * the MediaRecorder/getUserMedia plumbing so it's actually testable
 * (jsdom has neither API).
 */

/** "0:07", "1:03", "12:00" --- elapsed recording time, for the on-screen timer. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** A filename for the recorded Blob --- flows into the same File-based attachment pipeline as a picked file (v. CapsulesPanel/createCapsule). */
export function recordingFilename(kind: "audio" | "video", timestamp: number, extension: string): string {
  const iso = new Date(timestamp).toISOString().replace(/[:.]/g, "-");
  const label = kind === "audio" ? "messaggio-audio" : "messaggio-video";
  return `${label}-${iso}.${extension}`;
}
