import { expect, type Page } from "@playwright/test";
import { fullName, type TestUser } from "./test-users";

/**
 * Apre le Impostazioni dal menu utente. Il popup "Crea la tua master key" (una tantum) può comparire in qualunque
 * momento dopo il login e chiude il menu o ne stacca le voci mentre si clicca: si riprova l'intero gesto finché
 * il menu resta aperto abbastanza a lungo. Un `goto("/settings")` sarebbe più semplice ma ricarica la pagina e
 * blocca di nuovo la cassaforte, che molti test hanno appena sbloccato.
 */
export async function openSettings(page: Page, user: TestUser) {
  const menuButton = page.getByRole("button", { name: fullName(user) });
  const settingsLink = page.getByRole("link", { name: "Impostazioni" });

  await expect(async () => {
    if (!(await settingsLink.isVisible())) await menuButton.click();
    await settingsLink.click({ timeout: 3_000 });
    await expect(page).toHaveURL(/\/settings/, { timeout: 5_000 });
  }).toPass({ timeout: 40_000 });
}
