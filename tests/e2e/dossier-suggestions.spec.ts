import { expect, test, type Page } from "./fixtures";
import { buildPdf, POLIZZA, setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Fascicoli suggeriti: tre documenti dello stesso bene e nessun fascicolo, Hinthial propone di riunirli; poi un quarto
// documento dello stesso bene compare in "Forse appartengono qui" nel fascicolo, e si aggiunge con un clic.

async function createAsset(page: Page, name: string, categoryLabel: string) {
  await page.getByRole("link", { name: "Beni", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill(name);
  await page.locator("#categoryId").selectOption({ label: categoryLabel });
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page.getByText("Bene creato.")).toBeVisible();
}

/** Carica un PDF già collegato al bene, dal passo "Dettagli". */
async function uploadForAsset(page: Page, filename: string, categoryLabel: string, assetName: string) {
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', { name: filename, mimeType: "application/pdf", buffer: buildPdf(POLIZZA) });
  await expect(page.getByText("Letto sul dispositivo")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Dettagli" }).click();
  await page.getByLabel("Categoria").selectOption({ label: categoryLabel });
  await page.getByLabel("Bene collegato").selectOption({ label: assetName });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });
}

test("propone un fascicolo per tre documenti dello stesso bene, e suggerisce il quarto dentro il fascicolo", async ({ page }) => {
  test.slow();

  // Il primo documento, poi il bene.
  await setUpWithDocument(page, { filename: "panda-1.pdf" });
  await createAsset(page, "Fiat Panda", "🏠 Casa");

  // Il primo documento si collega al bene dalla sua scheda.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: /panda-1\.pdf/ }).click();
  await page.getByRole("tab", { name: "Scheda" }).click();
  await page.getByLabel("Categoria").selectOption({ label: "🏠 Casa" });
  await page.getByLabel("Bene collegato").selectOption({ label: "Fiat Panda" });
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByRole("button", { name: "Salva modifiche" })).toBeDisabled({ timeout: 20_000 });

  // Con uno e con due documenti Hinthial tace.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await expect(page.getByText(/Ancora nessun fascicolo/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Fascicoli suggeriti" })).toHaveCount(0);

  await uploadForAsset(page, "panda-2.pdf", "🏠 Casa", "Fiat Panda");
  await uploadForAsset(page, "panda-3.pdf", "🏠 Casa", "Fiat Panda");

  // Con tre, propone il fascicolo: accettando nasce col nome del bene e dentro ci sono i tre documenti.
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  const suggestions = page.getByRole("region", { name: "Fascicoli suggeriti" });
  await expect(suggestions).toContainText("Hai 3 documenti di «Fiat Panda»", { timeout: 15_000 });
  await suggestions.getByRole("button", { name: "Crea il fascicolo" }).click();

  await expect(page).toHaveURL(/\/dossiers\/[0-9a-f-]+/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Fiat Panda" })).toBeVisible();
  const cronologia = page.getByRole("region", { name: "Cronologia" });
  for (const name of ["panda-1.pdf", "panda-2.pdf", "panda-3.pdf"]) {
    await expect(cronologia.getByRole("link", { name: new RegExp(name.replace(".", "\\.")) })).toBeVisible();
  }

  // Un quarto documento dello stesso bene, caricato fuori dal fascicolo, è tra i suggeriti della scheda.
  await uploadForAsset(page, "panda-4.pdf", "🏠 Casa", "Fiat Panda");
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await page.getByRole("link", { name: /Fiat Panda/ }).click();
  const forse = page.getByRole("region", { name: "Forse appartengono qui" });
  await expect(forse).toContainText("panda-4.pdf", { timeout: 15_000 });
  await forse.getByRole("button", { name: /Aggiungi panda-4\.pdf al fascicolo/ }).click();
  await expect(page.getByText("Documento aggiunto al fascicolo.")).toBeVisible({ timeout: 15_000 });
  await expect(cronologia.getByRole("link", { name: /panda-4\.pdf/ })).toBeVisible();
  await expect(forse).toHaveCount(0);
});
