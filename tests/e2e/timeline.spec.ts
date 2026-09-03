import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("la cronologia elenca asset e documenti creati, raggruppati per mese", async ({ page }) => {
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
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  // Prima di aggiungere qualunque cosa, la cronologia è vuota.
  await page.getByRole("link", { name: "Cronologia" }).click();
  await expect(page.getByRole("heading", { name: "Cronologia" })).toBeVisible();
  await expect(page.getByText("Non c'è ancora nulla da mostrare qui.")).toBeVisible();

  await page.getByRole("link", { name: "Asset" }).click();
  await page.getByRole("link", { name: "+ Crea asset" }).click();
  await page.getByLabel("Nome").fill("Appartamento");
  await page.getByRole("button", { name: "Aggiungi asset" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("polizza di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("polizza.txt")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "Cronologia" }).click();
  await expect(page.getByRole("heading", { name: "Cronologia" })).toBeVisible();

  // Un solo gruppo mensile (entrambi creati ora), con entrambi gli elementi collegabili alla loro pagina.
  const assetLink = page.getByRole("link", { name: "Appartamento" });
  const documentLink = page.getByRole("link", { name: "polizza.txt" });
  await expect(assetLink).toBeVisible();
  await expect(documentLink).toBeVisible();

  await assetLink.click();
  await expect(page).toHaveURL(/\/assets$/);
});
