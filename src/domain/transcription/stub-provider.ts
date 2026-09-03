import type { TranscriptionProvider } from "@/domain/transcription/types";

/**
 * v. types.ts --- non elabora l'audio/video ricevuto (bytes/mimeType
 * volutamente ignorati): resta in attesa di un motore locale reale
 * (FASE 11). I chiamanti trattano `null` come "scrivila tu, per ora".
 */
export const stubTranscriptionProvider: TranscriptionProvider = {
  name: "Nessun motore automatico ancora disponibile",
  async transcribe() {
    return null;
  },
};
