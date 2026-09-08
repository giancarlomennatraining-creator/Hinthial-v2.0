import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// A differenza degli altri file di questa suite, importa `test`/`expect`
// direttamente da "@playwright/test", non da "./fixtures": quel file
// chiude automaticamente questo stesso popup per ogni altro test, quindi
// qui non va usato, altrimenti si chiuderebbe da sé prima di poter
// verificare alcunché.

test("il popup \"Crea la tua master key\" compare una sola volta, subito dopo il login, finché la cifratura non è configurata", async ({
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

  // Compare da sé, senza bisogno di cliccare nulla.
  const modal = page.getByRole("dialog", { name: "Crea la tua master key" });
  await expect(modal).toBeVisible();
  await expect(
    modal.getByRole("heading", { name: "Proteggi i tuoi dati con una master password" }),
  ).toBeVisible();
  await expect(modal.getByText("Password account")).toBeVisible();
  await expect(modal.getByText("Master password", { exact: true })).toBeVisible();

  // "Più tardi" lo chiude senza navigare altrove...
  await page.getByRole("button", { name: "Più tardi" }).click();
  await expect(modal).not.toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);

  // ...e non ricompare più, nemmeno dopo un refresh vero (sincronizzato
  // sul server, come onboarding_widget_hidden) --- una tantum per davvero.
  await page.reload();
  await expect(modal).not.toBeVisible();

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  // Configurata la cifratura, il popup non ha comunque più motivo di
  // comparire (a prescindere dal flag) --- verificato tornando in dashboard.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(modal).not.toBeVisible();
});

test("il tasto \"Crea la tua master key\" porta al modulo di creazione", async ({ page }) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  const modal = page.getByRole("dialog", { name: "Crea la tua master key" });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Crea la tua master key" }).click();

  await expect(page).toHaveURL(/\/archive$/);
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Configura la cifratura" })).toBeVisible();
});
