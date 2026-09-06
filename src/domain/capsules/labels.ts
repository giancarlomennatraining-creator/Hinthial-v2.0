import type { CapsuleStatus } from "@/domain/capsules/types";

/** Estratta da CapsulesPanel per essere riusabile anche altrove (es. PrivacyPanel, Impostazioni > Privacy). */
export const CAPSULE_STATUS_LABEL: Record<CapsuleStatus, string> = {
  draft: "Bozza",
  ready: "Chiusa",
  shared: "Condivisa",
};
