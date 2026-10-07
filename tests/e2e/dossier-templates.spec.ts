import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Nuovo fascicolo da un modello: propone le fasi, i documenti attesi e quelli già presenti che sembrano appartenerci.

test("un fascicolo nato da un modello ha le fasi, i documenti attesi e i documenti già trovati", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page, { filename: "visura-catastale.pdf" });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await page.getByRole("link", { name: "+ Nuovo fascicolo" }).click();

  // Parti da zero resta il percorso di default: titolo vuoto, nessuna sezione del modello.
  await expect(page.getByLabel("Titolo")).toHaveValue("");
  await expect(page.getByRole("region", { name: "Le fasi" })).toHaveCount(0);

  // Scegliere un modello compila il titolo e mostra fasi, documenti attesi e quelli già trovati.
  await page.getByRole("button", { name: /Acquisto di una casa/ }).click();
  await expect(page.getByLabel("Titolo")).toHaveValue("Acquisto di una casa");
  await expect(page.getByLabel("Nomi delle fasi")).toHaveValue(/Ricerca, Proposta, Mutuo, Rogito, Chiavi in mano/);
  await expect(page.getByRole("region", { name: "Documenti attesi" })).toContainText("8 scelti");
  const trovati = page.getByRole("region", { name: "Documenti già trovati" });
  await expect(trovati).toContainText("Ho già trovato 1 documento", { timeout: 20_000 });
  await expect(trovati).toContainText("Sembra: Visura catastale");

  // Si toglie una voce, si cambia il titolo, e si crea.
  await page.getByLabel("Proposta d'acquisto").uncheck();
  await expect(page.getByRole("region", { name: "Documenti attesi" })).toContainText("7 scelti");
  await page.getByLabel("Titolo").fill("Casa di Via Roma");
  await page.getByRole("button", { name: "Crea fascicolo" }).click();

  // Si arriva alla scheda: fasi, documenti attesi (uno già soddisfatto) e il documento collegato.
  await expect(page).toHaveURL(/\/dossiers\/[0-9a-f-]+/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Casa di Via Roma" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Fasi" })).toContainText("Fase: Ricerca", { timeout: 15_000 });
  const attesi = page.getByRole("region", { name: "Documenti attesi" });
  await expect(attesi).toContainText("1 di 7", { timeout: 15_000 });
  await expect(attesi).not.toContainText("Proposta d'acquisto");
  await expect(attesi.getByRole("link", { name: /visura-catastale\.pdf/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Cronologia" }).getByRole("link", { name: /visura-catastale\.pdf/ })).toBeVisible();
});
