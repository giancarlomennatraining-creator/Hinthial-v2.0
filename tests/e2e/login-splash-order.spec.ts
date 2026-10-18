import { expect, test, type Page } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Dopo il login il logo si riempie per circa tre secondi (v. LoginSplash): la richiesta della master key --- la finestra di
// sblocco per chi ha la cassaforte, il popup "Crea la tua master key" per chi non l'ha ancora --- deve comparire solo a logo
// finito, non insieme a lui. Il server e2e parte con DISABLE_LOGIN_SPLASH=1 (il login non aggiunge il parametro): i test lo
// simulano aprendo la Dashboard con "?justLoggedIn=1", come farebbe il redirect dopo un vero login. Importa `test`/`expect`
// da "@playwright/test" e non da "./fixtures": quel file chiude da sé il popup e la finestra che qui si vogliono vedere.

const MASTER_PASSWORD = "una-master-password-solida";

async function login(page: Page) {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test("senza cassaforte, il popup \"Crea la tua master key\" compare dopo il logo, non durante", async ({ page }) => {
  test.slow();
  await login(page);
  // Il popup si vede una volta sola: lo si segna come visto dopo averlo provato, qui lo si vuole ancora "non visto".
  await page.goto("/dashboard?justLoggedIn=1");

  const splash = page.getByRole("status", { name: "Accesso in corso" });
  const modal = page.getByRole("dialog", { name: "Crea la tua master key" });
  await expect(splash).toBeVisible();
  // Per tutto il tempo del logo il popup non c'è.
  await page.waitForTimeout(1_500);
  await expect(splash).toBeVisible();
  await expect(modal).toHaveCount(0);

  // Finito il logo (barra piena e dissolvenza), compare.
  await expect(splash).toHaveCount(0, { timeout: 10_000 });
  await expect(modal).toBeVisible({ timeout: 10_000 });
});

test("con la cassaforte bloccata, la finestra di sblocco compare dopo il logo, non durante", async ({ page }) => {
  test.slow();
  await login(page);

  // Crea la cassaforte, poi simula un nuovo accesso: ricaricando la cassaforte torna bloccata.
  await page.getByRole("dialog", { name: "Crea la tua master key" }).getByRole("button", { name: "Più tardi" }).click().catch(() => {});
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  await page.goto("/dashboard?justLoggedIn=1");
  const splash = page.getByRole("status", { name: "Accesso in corso" });
  const unlock = page.getByRole("dialog", { name: "Sblocca la cassaforte" });
  await expect(splash).toBeVisible();
  await page.waitForTimeout(1_500);
  await expect(splash).toBeVisible();
  await expect(unlock).toHaveCount(0);

  await expect(splash).toHaveCount(0, { timeout: 10_000 });
  await expect(unlock).toBeVisible({ timeout: 10_000 });
  await expect(unlock.getByLabel("Master password", { exact: true })).toBeVisible();
});
