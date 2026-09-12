import type { CapsuleStatus } from "@/domain/capsules/types";
import type { NavOrientation } from "@/lib/nav-orientation";

/**
 * Tutto quello che questa interfaccia elenca è già visibile al server
 * in chiaro oggi --- nessuna di queste informazioni richiede di
 * decifrare nulla (v. domain/privacy/repository.ts). Usata da
 * Impostazioni > Privacy per mostrarlo esplicitamente, invece di
 * lasciarlo implicito.
 */
export interface AccountVisibilitySummary {
  /** ISO. */
  accountCreatedAt: string;
  documentCount: number;
  assetCount: number;
  friendCount: number;
  activeFriendCount: number;
  guardianCount: number;
  capsuleCount: number;
  capsuleStatusCounts: Record<CapsuleStatus, number>;
  /** Nomi delle categorie usate --- la tassonomia è in chiaro, non un dato del vault. */
  categoryNames: string[];
  navOrientation: NavOrientation;
  /** Se il gadget "Onboarding" nella barra è nascosto --- v. OnboardingWidgetVisibilityProvider. */
  onboardingWidgetHidden: boolean;
}
