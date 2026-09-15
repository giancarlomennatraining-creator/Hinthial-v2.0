import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Import diretto da "@playwright/test", non da "./fixtures": quel file
// chiude da sé il popup "Crea la tua master key" ogni volta che compare,
// ma qui va chiuso a mano per riprodurre esattamente la sequenza del
// bug (v. sotto).

test.use({ viewport: { width: 375, height: 800 } });

test("il tasto ☰ apre il cassetto anche subito dopo aver chiuso il popup \"Crea la tua master key\"", async ({
  page,
}) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // Chiuso a mano (non dall'handler automatico di fixtures.ts) --- il
  // bug si manifestava proprio nell'istante subito dopo, quando altri
  // componenti (ricerca globale, indicatore Onboarding) si montano per
  // la prima volta dentro il cassetto appena apre (v.
  // lib/use-mounted-transition.ts): lo stato "montato" del cassetto
  // veniva perso senza che nulla lo richiudesse esplicitamente --- il
  // tasto sembrava "senza alcun effetto" (v. segnalazione utente).
  const modal = page.getByRole("dialog", { name: "Crea la tua master key" });
  await expect(modal).toBeVisible();
  await page.getByRole("button", { name: "Più tardi" }).click();
  await expect(modal).not.toBeVisible();

  const menuButton = page.getByRole("button", { name: "Apri il menu" });
  await menuButton.click();
  await expect(page.getByRole("dialog", { name: "Menu di navigazione" })).toBeVisible();
});
