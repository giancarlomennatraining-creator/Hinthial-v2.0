import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("importa contatti fiduciari da CSV: template, anteprima con riga da correggere, risultato", async ({
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

  await page.getByRole("link", { name: "Importa/Esporta" }).click();
  await expect(page).toHaveURL(/\/import-export$/);
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();

  const importTab = page.getByRole("tab", { name: "Importa" });
  const exportTab = page.getByRole("tab", { name: "Esporta" });
  await expect(importTab).toHaveAttribute("aria-selected", "true");

  // PASSO 1: scelta del tipo.
  await page.getByRole("button", { name: "Contatti fiduciari" }).click();

  // PASSO 2: template + spiegazione colonne.
  await expect(page.getByRole("heading", { name: "Template: Contatti fiduciari" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Nome", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Email", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Ruolo", exact: true })).toBeVisible();

  const [templateDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Scarica template .csv" }).click(),
  ]);
  expect(templateDownload.suggestedFilename()).toBe("hinthial-template-contatti-fiduciari.csv");

  await page.getByRole("button", { name: "Avanti" }).click();

  // PASSO 3: carica il file compilato --- una riga valida, una con email non valida.
  const csv = [
    "Nome,Email,Ruolo",
    "Maria Rossi,maria.rossi@esempio.it,Coniuge",
    "Luca Bianchi,non-una-email,Fratello",
  ].join("\n");
  await page.setInputFiles('input[type="file"]', {
    name: "contatti.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf-8"),
  });

  // PASSO 4: anteprima --- avanza automaticamente dopo il parsing.
  await expect(page.getByRole("heading", { name: "Anteprima" })).toBeVisible();
  await expect(page.getByText("Maria Rossi")).toBeVisible();
  await expect(page.getByText("Luca Bianchi")).toBeVisible();
  await expect(page.getByText("Email non valida.")).toBeVisible();
  await expect(page.getByText("Pronta", { exact: true })).toBeVisible();
  await expect(page.getByText("Da correggere", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Importa 1 riga" }).click();

  // PASSO 5: risultato.
  await expect(page.getByRole("heading", { name: "Importazione completata" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("1 elemento importato.")).toBeVisible();
  await expect(page.getByText("1 riga saltata.")).toBeVisible();

  await page.getByRole("link", { name: "Vai a Contatti" }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  await expect(page.locator("li", { hasText: "Maria Rossi" })).toBeVisible();
  await expect(page.getByText("Luca Bianchi")).not.toBeVisible();

  // La scheda Esporta (traslocata da Impostazioni) resta raggiungibile dalla stessa pagina.
  await page.getByRole("link", { name: "Importa/Esporta" }).click();
  await exportTab.click();
  await expect(page.getByRole("heading", { name: "Esporta i tuoi dati" })).toBeVisible();
});

test("importa asset da CSV: corregge una categoria non trovata creandola al volo", async ({ page }) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Importa/Esporta" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();

  await page.getByRole("button", { name: "Asset", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Template: Asset" })).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();

  // "Immobili" non esiste ancora fra le categorie di un account nuovo.
  const csv = ["Nome,Categoria", "Casa al mare,Immobili"].join("\n");
  await page.setInputFiles('input[type="file"]', {
    name: "asset.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf-8"),
  });

  await expect(page.getByRole("heading", { name: "Anteprima" })).toBeVisible();
  await expect(page.getByText("Da correggere", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox")).toContainText('"Immobili" non trovato/a: scegli categoria');

  await page.getByRole("combobox").selectOption({ label: '+ Crea categoria "Immobili"' });
  await expect(page.getByText('Verrà creato/a: "Immobili"')).toBeVisible();
  await expect(page.getByText("Pronta", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Importa 1 riga" }).click();
  await expect(page.getByRole("heading", { name: "Importazione completata" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("1 elemento importato.")).toBeVisible();

  await page.getByRole("link", { name: "Vai ad Asset" }).click();
  await expect(page).toHaveURL(/\/assets$/);
  const assetRow = page.locator("li", { hasText: "Casa al mare" });
  await expect(assetRow).toBeVisible();
  await expect(assetRow.getByText("Immobili")).toBeVisible();
});
