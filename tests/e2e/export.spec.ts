import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("esporta tutti i dati in un unico archivio .zip", async ({ page }) => {
  // Cifratura reale (PBKDF2 x2), un upload e la generazione dello zip
  // client-side possono superare il timeout di default di 30s.
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // Un documento vero, per verificare che l'export includa anche i file
  // originali, non solo i metadati.
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

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.setInputFiles('input[type="file"]', {
    name: "appunti.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("qualcosa da esportare", "utf-8"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("appunti.txt")).toBeVisible({ timeout: 15_000 });

  // Impostazioni -> Importa/Esporta -> Esporta.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("tab", { name: "Importa/Esporta" }).click();
  // exact: true --- la scheda di Impostazioni appena cliccata sopra
  // contiene "Esporta" come sottostringa, altrimenti ambigua con questa.
  await page.getByRole("tab", { name: "Esporta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Esporta i tuoi dati" })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Scarica tutti i dati (.zip)" }).click(),
  ]);

  // Almeno 2 file nell'archivio: appunti.txt + manifest.json.
  await expect(page.getByText(/Archivio scaricato: \d+ file/)).toBeVisible({ timeout: 20_000 });

  expect(download.suggestedFilename()).toMatch(/^hinthial-export-\d{4}-\d{2}-\d{2}\.zip$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  // Verifica minimale ma concreta che sia un vero .zip non vuoto: la
  // firma "PK" dell'header locale del primo file (formato ZIP).
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile(downloadPath!);
  expect(bytes.length).toBeGreaterThan(100);
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
});
