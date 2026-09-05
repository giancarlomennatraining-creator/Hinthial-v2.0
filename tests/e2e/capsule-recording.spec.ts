import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
// Chromium runs with --use-fake-device-for-media-stream (v.
// playwright.config.ts): getUserMedia resolves with a synthetic
// camera/mic stream, no real hardware or manual permission needed.

test("registra un messaggio audio e lo allega a una capsula", async ({ page }) => {
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

  await page.getByRole("link", { name: "Capsule" }).click();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();

  await page.getByLabel("Titolo").fill("Per Maria");
  await page.getByLabel("Data di apertura", { exact: true }).fill("2027-01-01");
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();

  await page.getByRole("button", { name: "🎤 Registra audio" }).click();
  await expect(page.getByText(/Registrazione · 0:0/)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Ferma registrazione" }).click();

  // Anteprima con player e conferma.
  await expect(page.locator("audio")).toBeVisible();
  await page.getByRole("button", { name: "Aggiungi alla capsula" }).click();
  await expect(page.getByText(/🎤 messaggio-audio-/)).toBeVisible();

  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("✅ Capsula creata.")).toBeVisible();

  // L'allegato registrato compare nella capsula con l'icona 🎤, apribile come qualsiasi altro allegato.
  await expect(page.getByText(/🎤 messaggio-audio-.*\.webm/)).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Apri" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^messaggio-audio-.*\.webm$/);
});
