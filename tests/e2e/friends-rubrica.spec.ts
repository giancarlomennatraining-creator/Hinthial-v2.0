import { expect, test, type Page } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// La rubrica degli amici: indice a lettere, elenco e scheda della persona. Su schermo largo elenco e scheda stanno
// affiancati; su smartphone si vede la rubrica e, toccando una persona, la sua scheda con "← Rubrica" per tornare.

const MASTER_PASSWORD = "una-master-password-solida";

async function signInAndAddFriends(page: Page, friends: { name: string; email: string; role: string }[]) {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Amici" }).click();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Amici" })).toBeVisible();

  for (const friend of friends) {
    await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
    await page.getByLabel("Nome visualizzato").fill(friend.name);
    await page.getByLabel("Email").fill(friend.email);
    await page.getByLabel("Ruolo").fill(friend.role);
    await page.getByRole("button", { name: "Aggiungi amico" }).click();
    await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
    await expect(page.getByRole("region", { name: "Rubrica" })).toBeVisible({ timeout: 10_000 });
  }
}

const PEOPLE = [
  { name: "Marta Rossi", email: "marta.rossi@esempio.it", role: "Coniuge" },
  { name: "Davide Costa", email: "davide.costa@esempio.it", role: "Amico" },
  { name: "Luca Bianchi", email: "luca.bianchi@esempio.it", role: "Fratello" },
];

test("su schermo largo la rubrica ha l'indice a lettere e la scheda accanto all'elenco", async ({ page }) => {
  test.slow();
  await signInAndAddFriends(page, PEOPLE);

  const rubrica = page.getByRole("region", { name: "Rubrica" });
  // In ordine alfabetico, sotto la lettera del nome; le lettere senza nessuno sono spente.
  await expect(rubrica.locator("[data-letter]")).toHaveText(["D", "L", "M"]);
  await expect(rubrica.getByRole("button", { name: "Vai alla lettera D" })).toBeEnabled();
  await expect(rubrica.getByRole("button", { name: "Vai alla lettera Z" })).toBeDisabled();

  // La prima persona (Davide Costa) è già aperta; scegliendone un'altra la scheda cambia.
  await expect(page.getByRole("region", { name: "Scheda di Davide Costa" })).toBeVisible();
  await rubrica.getByRole("button", { name: /Marta Rossi/ }).click();
  const scheda = page.getByRole("region", { name: "Scheda di Marta Rossi" });
  await expect(scheda).toContainText("Coniuge");
  await expect(scheda).toContainText("marta.rossi@esempio.it");
  await expect(scheda).toContainText("Nessuna capsula affidata a Marta.");
  await expect(rubrica).toBeVisible();
  // Su schermo largo non serve tornare indietro.
  await expect(scheda.getByRole("button", { name: "← Rubrica" })).toBeHidden();

  // La ricerca restringe l'elenco.
  await rubrica.getByLabel("Cerca tra gli amici").fill("costa");
  await expect(rubrica.getByRole("button", { name: /Davide Costa/ })).toBeVisible();
  await expect(rubrica.getByRole("button", { name: /Marta Rossi/ })).toHaveCount(0);
  await rubrica.getByLabel("Cerca tra gli amici").fill("nessuno-con-questo-nome");
  await expect(rubrica).toContainText("Nessuno corrisponde alla ricerca.");
});

test("su smartphone si vede la rubrica, toccando una persona la sua scheda, e \"← Rubrica\" riporta all'elenco", async ({ page }) => {
  test.slow();
  // Si prepara da schermo largo (sullo smartphone la barra in basso non ha "Amici"), poi lo schermo si stringe.
  await signInAndAddFriends(page, PEOPLE);
  await page.setViewportSize({ width: 390, height: 844 });

  const rubrica = page.getByRole("region", { name: "Rubrica" });
  await expect(rubrica).toBeVisible();
  // Solo la rubrica: la scheda non c'è finché non si tocca una persona.
  await expect(page.getByRole("region", { name: /^Scheda di/ })).toBeHidden();

  await rubrica.getByRole("button", { name: /Marta Rossi/ }).click();
  const scheda = page.getByRole("region", { name: "Scheda di Marta Rossi" });
  await expect(scheda).toBeVisible();
  await expect(scheda).toContainText("marta.rossi@esempio.it");
  await expect(rubrica).toBeHidden();

  await scheda.getByRole("button", { name: "← Rubrica" }).click();
  await expect(rubrica).toBeVisible();
  await expect(scheda).toBeHidden();
  await expect(rubrica.getByRole("button", { name: /Davide Costa/ })).toBeVisible();

  // Un'altra persona: stessa cosa.
  await rubrica.getByRole("button", { name: /Davide Costa/ }).click();
  const schedaDavide = page.getByRole("region", { name: "Scheda di Davide Costa" });
  await expect(schedaDavide).toBeVisible();

  // Il tasto "indietro" del telefono (del browser) torna alla rubrica senza lasciare la pagina; "avanti" riapre la scheda.
  await page.goBack();
  await expect(rubrica).toBeVisible();
  await expect(schedaDavide).toBeHidden();
  await expect(page).toHaveURL(/\/friends$/);
  await page.goForward();
  await expect(schedaDavide).toBeVisible();
  await expect(rubrica).toBeHidden();

  // E "← Rubrica" fa lo stesso: dopo, un solo "indietro" lascia davvero la pagina (non resta un passo fantasma).
  await schedaDavide.getByRole("button", { name: "← Rubrica" }).click();
  await expect(rubrica).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/\/friends$/);
});