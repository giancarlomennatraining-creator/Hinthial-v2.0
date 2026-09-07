import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("le voci di navigazione che richiedono la cifratura mostrano un pallino finché non è configurata, senza cambiare il loro nome accessibile", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  const archiveLink = page.getByRole("link", { name: "Archivio", exact: true });
  const dashboardLink = page.getByRole("link", { name: "Dashboard", exact: true });

  // Prima della configurazione: pallino sulle voci che la richiedono...
  await expect(archiveLink.locator(".bg-orange-500")).toBeVisible();
  // ...non su Dashboard, che non ne ha bisogno.
  await expect(dashboardLink.locator(".bg-orange-500")).toHaveCount(0);

  await archiveLink.click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  // Configurata: il pallino sparisce.
  await expect(archiveLink.locator(".bg-orange-500")).toHaveCount(0);
});
