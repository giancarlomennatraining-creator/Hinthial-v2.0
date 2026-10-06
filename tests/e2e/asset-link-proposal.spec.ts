import { expect, test, type Page } from "./fixtures";
import { enableHinthia, askHinthia, mockHinthiaReading, buildPdf, POLIZZA, setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Il bene impara dai documenti già collegati: la polizza A (numero ABC12345) è collegata alla Panda, la polizza B ha
// lo stesso numero, quindi Hinthial propone di collegarla alla Panda. La lettura di Hinthia è simulata (v. hinthia.ts).

async function createAsset(page: Page, name: string, categoryLabel: string) {
  await page.getByRole("link", { name: "Beni", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill(name);
  await page.locator("#categoryId").selectOption({ label: categoryLabel });
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page.getByText("Bene creato.")).toBeVisible();
}

async function uploadPolizza(page: Page, filename: string) {
  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', { name: filename, mimeType: "application/pdf", buffer: buildPdf(POLIZZA) });
  await expect(page.getByText("Letto sul dispositivo")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 30_000 });
}

test("propone di collegare la polizza al bene che ha già un documento con lo stesso numero, e si annulla", async ({ page }) => {
  test.slow();

  // Scadenza, emittente e due campi liberi per ogni polizza (senza categoria).
  await mockHinthiaReading(page, { fields: true, category: false });
  await setUpWithDocument(page, { filename: "polizza-a.pdf" });
  await enableHinthia(page);

  await createAsset(page, "Fiat Panda", "🏠 Casa");
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: /polizza-a\.pdf/ }).click();

  // La polizza A: Hinthia la legge, il numero finisce nella Scheda, poi la si collega alla Panda a mano.
  await askHinthia(page, 4);
  await page.getByRole("tab", { name: "Scheda" }).click();
  await page.getByRole("group", { name: "Informazioni trovate da Hinthia" }).getByRole("button", { name: "Accetta tutto" }).click();
  await expect(page.getByRole("status", { name: "Ultima proposta" })).toContainText("informazioni aggiunte", { timeout: 20_000 });
  await page.getByLabel("Categoria").selectOption({ label: "🏠 Casa" });
  await page.getByLabel("Bene collegato").selectOption({ label: "Fiat Panda" });
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByRole("button", { name: "Salva modifiche" })).toBeDisabled({ timeout: 20_000 });

  // La polizza B, con lo stesso numero: tra le proposte compare il collegamento.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await uploadPolizza(page, "polizza-b.pdf");
  await page.getByRole("link", { name: /polizza-b\.pdf/ }).click();
  await askHinthia(page, 5);

  await expect(page.getByText(/Stesso numero di polizza/)).toBeVisible();
  await page.getByRole("button", { name: "Collega" }).click();
  await expect(page.getByRole("status", { name: "Ultima proposta" })).toContainText("Collegato a Fiat Panda", { timeout: 20_000 });

  await page.getByRole("tab", { name: "Scheda" }).click();
  await expect(page.getByLabel("Bene collegato").locator("option:checked")).toHaveText("Fiat Panda");

  await page.getByRole("status", { name: "Ultima proposta" }).getByRole("button", { name: "Annulla" }).click();
  await expect(page.getByLabel("Bene collegato").locator("option:checked")).toHaveText("Scegli prima una categoria", { timeout: 20_000 });
});

test("da una polizza propone di creare il bene, lo crea collegando il documento, e il bene mostra le sue scadenze", async ({ page }) => {
  test.slow();

  const lines = [...POLIZZA, "Oggetto assicurato: Ford Focus 1.5 EcoBlue", "Targa: EY389YM"];
  await mockHinthiaReading(page, {
    category: false,
    extraFields: [
      { key: "oggetto_assicurato", label: "Oggetto assicurato", value: "Ford Focus 1.5 EcoBlue", quote: "Oggetto assicurato: Ford Focus 1.5 EcoBlue" },
      { key: "targa", label: "Targa", value: "EY389YM", quote: "Targa: EY389YM" },
    ],
  });
  await setUpWithDocument(page, { filename: "polizza-focus.pdf", lines });
  await enableHinthia(page);

  // Scadenza, emittente, due campi e il bene da creare.
  await askHinthia(page, 5);
  await page.getByRole("tab", { name: "Scheda" }).click();
  await page.getByRole("group", { name: "Informazioni trovate da Hinthia" }).getByRole("button", { name: "Accetta tutto" }).click();
  await expect(page.getByRole("status", { name: "Ultima proposta" })).toContainText("informazioni aggiunte", { timeout: 20_000 });

  await page.getByRole("tab", { name: /^Chiedi a Hinthia/ }).click();
  await expect(page.getByText("Nuovo bene: Ford Focus 1.5 EcoBlue (EY389YM)")).toBeVisible();
  await page.getByRole("button", { name: "Crea e collega" }).click();
  const lastAction = page.getByRole("status", { name: "Ultima proposta" });
  await expect(lastAction).toContainText('Bene "Ford Focus 1.5 EcoBlue (EY389YM)" creato e collegato', { timeout: 20_000 });

  // Annullando, il bene sparisce e la proposta torna.
  await lastAction.getByRole("button", { name: "Annulla" }).click();
  await expect(page.getByRole("button", { name: "Crea e collega" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "Scheda" }).click();
  await expect(page.getByLabel("Bene collegato").locator("option:checked")).toHaveText("Scegli prima una categoria");

  await page.getByRole("tab", { name: /^Chiedi a Hinthia/ }).click();
  await page.getByRole("button", { name: "Crea e collega" }).click();
  await expect(lastAction).toContainText("creato e collegato", { timeout: 20_000 });
  await page.getByRole("tab", { name: "Scheda" }).click();
  await expect(page.getByLabel("Bene collegato").locator("option:checked")).toHaveText("Ford Focus 1.5 EcoBlue (EY389YM)");

  // Il bene mostra la scadenza del documento collegato.
  await page.getByRole("link", { name: "Beni", exact: true }).click();
  const asset = page.getByRole("listitem").filter({ hasText: "Ford Focus 1.5 EcoBlue (EY389YM)" });
  await expect(asset).toContainText("polizza-focus.pdf scade", { timeout: 15_000 });
});
