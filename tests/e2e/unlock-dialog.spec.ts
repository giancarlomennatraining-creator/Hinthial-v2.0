import { expect, test as base, type Page } from "@playwright/test";
import { createConfirmedTestUser, fullName, uniqueTestUser, type TestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * Come `test` di fixtures.ts, ma chiude solo il popup "Crea la tua master key": quello di fixtures.ts clicca ogni
 * pulsante "Più tardi", compreso quello della finestra di sblocco che qui si vuole vedere (e provare) davvero.
 */
const test = base.extend({
  page: async ({ page }, use) => {
    const intro = page.getByRole("dialog", { name: "Crea la tua master key" }).getByRole("button", { name: "Più tardi" });
    // Con un limite di tempo, come in fixtures.ts: se la pagina apre da sola la finestra di creazione mentre lo si clicca,
    // il popup sparisce e il clic altrimenti resterebbe ad aspettarlo fino alla fine del test.
    await page.addLocatorHandler(intro, async () => {
      await intro.click({ timeout: 3_000 }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright's fixture callback param, not React's use() hook.
    await use(page);
  },
});

const MASTER_PASSWORD = "una-master-password-solida";

async function loginAndCreateVault(page: Page): Promise<TestUser> {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();
  return user;
}

test("lo sblocco è una finestra sopra la dashboard: compare subito, si chiude con 'Più tardi', si riapre da un pulsante, e uno sbaglio mostra l'errore", async ({
  page,
}) => {
  test.slow();
  await loginAndCreateVault(page);

  // Ricaricando la cassaforte torna bloccata: la finestra compare da sola sopra la dashboard.
  await page.goto("/dashboard");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole("heading", { name: "Sblocca" })).toBeVisible();

  // "Più tardi" la chiude; ricaricando nella stessa sessione non si riapre da sola, ma c'è il pulsante.
  await dialog.getByRole("button", { name: "Più tardi" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sblocca ora" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Sblocca ora" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Esc la chiude (qui si può), poi la si riapre e si sbaglia password.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Sblocca ora" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("sbagliata");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Non corretta" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog")).toBeVisible();

  // Quella giusta sblocca: la finestra sfuma, compare "Cassaforte sbloccata." e la dashboard si vede.
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  // Mentre la finestra si dissolve la dashboard non è ancora popolata: lo fa solo a fine animazione.
  await expect(page.locator('.unlock-glass[data-phase="success"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Continuità" })).not.toBeVisible();
  await expect(page.getByText("Cassaforte sbloccata.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Continuità" })).toBeVisible({ timeout: 15_000 });
});

test("una pagina che serve la chiave apre lo sblocco da sola, nel vetro (dispositivo non fidato), non si può chiudere e la pagina si popola solo a fine animazione", async ({
  page,
}) => {
  test.slow();
  await loginAndCreateVault(page);

  await page.goto("/archive");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.locator(".unlock-glass")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Più tardi" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await dialog.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(dialog.locator('.unlock-glass[data-phase="success"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Archivio" })).not.toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible({ timeout: 20_000 });
});

test("la creazione della master password è una finestra nel vetro; poi la cassaforte si può bloccare dal menu e si riapre lo sblocco", async ({
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

  // Una pagina che serve la chiave apre la creazione, nella cornice del vetro, e non si può chiudere.
  await page.goto("/archive");
  const dialog = page.getByRole("dialog", { name: "Crea la master password" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.locator(".unlock-glass")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Più tardi" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  // Password diverse: un errore chiaro, la finestra resta.
  await dialog.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await dialog.getByLabel("Conferma master password").fill("un-altra-password");
  await dialog.getByRole("button", { name: "Crea" }).click();
  await expect(dialog.getByRole("alert")).toContainText("non coincidono");

  await dialog.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await dialog.getByRole("button", { name: "Crea" }).click();
  await expect(dialog.getByRole("heading", { name: "Salva la tua recovery key" })).toBeVisible({ timeout: 45_000 });
  await dialog.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await dialog.getByRole("button", { name: "Continua" }).click();

  // L'uscita è quella del vetro; la pagina si popola solo a fine animazione.
  await expect(dialog.locator('.unlock-glass[data-phase="success"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Ancora nulla in archivio")).not.toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Ancora nulla in archivio")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Master password creata.")).toBeVisible();

  // Dal menu utente si blocca la cassaforte a mano: la pagina torna da sbloccare, nello stesso vetro.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("button", { name: "Blocca Hinthial" }).click();
  const unlock = page.getByRole("dialog", { name: "Sblocca la cassaforte" });
  await expect(unlock).toBeVisible({ timeout: 15_000 });
  await expect(unlock.locator(".unlock-glass")).toBeVisible();
  await expect(page.getByText("Ancora nulla in archivio")).not.toBeVisible();

  await unlock.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await unlock.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByText("Ancora nulla in archivio")).toBeVisible({ timeout: 25_000 });

  // Da sbloccata, nel menu c'è "Blocca Hinthial"; bloccata (o dopo un ricaricamento) non c'è.
  await page.getByRole("button", { name: fullName(user) }).click();
  await expect(page.getByRole("button", { name: "Blocca Hinthial" })).toBeVisible();
});
