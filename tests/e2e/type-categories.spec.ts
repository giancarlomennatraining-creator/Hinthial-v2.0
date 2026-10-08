import { expect, test } from "./fixtures";
import { askHinthia, enableHinthia, MASTER_PASSWORD, mockHinthiaReading, setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md. Richiede la migrazione
// 20261005000000_document_type_categories.sql applicata.
//
// "Categoria proposta per tipo di documento": quando il motore non dà una categoria, ne propone una in base al tipo; in
// Impostazioni > Categorie l'utente cambia la corrispondenza. La lettura di Hinthia è simulata (v. hinthia.ts).

async function openCategoriesSettings(page: import("@playwright/test").Page) {
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Categorie" }).click();
  await expect(page.getByRole("heading", { name: "Categoria proposta per tipo di documento" })).toBeVisible({
    timeout: 20_000,
  });
}

test("la categoria proposta segue il tipo, e la scelta dell'utente la cambia", async ({ page }) => {
  test.slow();

  // Il motore dichiara una polizza ma non propone nessuna categoria: la dà l'app, dal tipo.
  await mockHinthiaReading(page, { category: false, documentType: "polizza" });
  await setUpWithDocument(page);
  await enableHinthia(page);
  const documentUrl = page.url();

  // Predefinito: scadenza, emittente e la categoria "Assicurazioni" calcolata dal tipo.
  await askHinthia(page, 3);
  const panel = page.getByRole("tabpanel", { name: /^Chiedi a Hinthia/ });
  await expect(panel).toContainText("Dal tipo di documento: Polizza assicurativa");
  // La categoria "Assicurazioni" è proposta dal tipo: lo dice la riga stessa del registro di lettura.
  await expect(panel).toContainText("Assicurazioni");

  // L'utente sceglie "Nessuna categoria" per le polizze: la scelta resta dopo un ricaricamento.
  await openCategoriesSettings(page);
  const polizza = page.getByLabel("Polizza assicurativa");
  await expect(polizza).toHaveValue("");
  await polizza.selectOption("none");
  await expect(polizza).toHaveValue("none");
  await page.reload();
  await page.getByRole("tab", { name: "Categorie" }).click();
  await expect(page.getByLabel("Polizza assicurativa")).toHaveValue("none", { timeout: 20_000 });

  // Rileggendo la scheda, la categoria dal tipo non c'è più: restano scadenza ed emittente.
  await page.goto(documentUrl);
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await page.getByRole("tab", { name: /^Chiedi a Hinthia/ }).click();
  await expect(page.getByRole("tab", { name: "Chiedi a Hinthia · 2" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("tabpanel", { name: /^Chiedi a Hinthia/ })).not.toContainText("Dal tipo di documento");

  // Torna alla predefinita: la categoria dal tipo ricompare.
  await openCategoriesSettings(page);
  await page.getByLabel("Polizza assicurativa").selectOption("");
  await expect(page.getByLabel("Polizza assicurativa")).toHaveValue("");
  await page.goto(documentUrl);
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await page.getByRole("tab", { name: /^Chiedi a Hinthia/ }).click();
  await expect(page.getByRole("tab", { name: "Chiedi a Hinthia · 3" })).toBeVisible({ timeout: 30_000 });
});
