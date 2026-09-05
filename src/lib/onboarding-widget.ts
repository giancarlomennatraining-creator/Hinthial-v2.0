/**
 * Se il gadget "Onboarding" nella barra di navigazione (v.
 * components/layout/OnboardingStatus) è nascosto --- una preferenza
 * d'aspetto legata a questo dispositivo (come il tema/la compressione
 * della barra laterale, v. lib/theme.ts e lib/sidebar.ts): vive solo in
 * localStorage, mai sincronizzata col server. L'avanzamento resta
 * comunque consultabile da Impostazioni > Onboarding, che può anche
 * far ricomparire il gadget (v. OnboardingSettingsPanel).
 */

const STORAGE_KEY = "hinthial-onboarding-widget-hidden";

export function getStoredOnboardingWidgetHidden(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function storeOnboardingWidgetHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, hidden ? "1" : "0");
  } catch {
    // Storage non disponibile (privacy mode, quota, ...): resta solo per questa sessione.
  }
}
