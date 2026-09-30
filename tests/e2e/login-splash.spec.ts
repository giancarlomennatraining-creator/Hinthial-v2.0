import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
// Il server e2e parte con DISABLE_LOGIN_SPLASH=1 (il login non aggiunge il parametro): il test lo simula aprendo la Dashboard con "?justLoggedIn=1", come farebbe il redirect dopo un vero login.

test("dopo il login la Dashboard si apre dietro il benvenuto (wordmark + barra), che sfuma dopo ~3 secondi e non ricompare", async ({
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
  await expect(page.getByRole("status", { name: "Accesso in corso" })).toHaveCount(0);

  await page.goto("/dashboard?justLoggedIn=1");
  const splash = page.getByRole("status", { name: "Accesso in corso" });
  await expect(splash).toBeVisible();
  await expect(splash.getByRole("img", { name: "Hinthial" })).toBeVisible();
  // Il parametro sparisce subito dall'URL: un refresh non rivede il benvenuto.
  await expect(page).toHaveURL(/\/dashboard$/);

  await expect(splash).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /^Ciao, / })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: /^Ciao, / })).toBeVisible();
  await expect(splash).toHaveCount(0);
});
