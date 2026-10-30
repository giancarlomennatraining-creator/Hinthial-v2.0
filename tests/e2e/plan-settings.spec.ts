import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openSettings } from "./settings-nav";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("Impostazioni > Il tuo piano nasconde e mostra l'indicatore nella barra, e il piano resta in Oggi", async ({ page }) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  // L'indicatore è visibile di default nella barra laterale (sbloccata: "1 su 9", la chiave).
  const indicator = page.getByRole("link", { name: /^Il tuo piano: / });
  await expect(indicator).toBeVisible({ timeout: 10_000 });

  // Si naviga a Impostazioni via menu utente (link, non page.goto): la master key vive solo in memoria.
  await openSettings(page, user);
  await page.getByRole("tab", { name: "Aspetto e preferenze" }).click();
  await expect(page.getByRole("heading", { name: "Il tuo piano" })).toBeVisible();
  await page.getByRole("button", { name: "Nascondi l'indicatore dalla barra di navigazione" }).click();
  await expect(page.getByRole("button", { name: "Mostra di nuovo l'indicatore nella barra di navigazione" })).toBeVisible();
  await expect(page.getByText("L'indicatore del piano non compare nella barra di navigazione. Il piano resta in Oggi.")).toBeVisible();

  // Nascosto l'indicatore, il piano è comunque in Oggi.
  await page.getByRole("link", { name: "Oggi" }).click();
  await expect(page.getByRole("region", { name: "Il tuo piano" })).toBeVisible({ timeout: 15_000 });
  await expect(indicator).not.toBeVisible();

  // Farlo ricomparire funziona allo stesso modo.
  await openSettings(page, user);
  await page.getByRole("tab", { name: "Aspetto e preferenze" }).click();
  await page.getByRole("button", { name: "Mostra di nuovo l'indicatore nella barra di navigazione" }).click();
  await page.getByRole("link", { name: "Oggi" }).click();
  await expect(indicator).toBeVisible({ timeout: 10_000 });
});
