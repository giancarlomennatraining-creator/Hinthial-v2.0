import { expect, test } from "./fixtures";
import { MASTER_PASSWORD, setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// L'Archivio ha sei viste (elenco, tabella, cassettiera, linea del tempo, collezioni, scaffale). La vista si sceglie dal
// menu "Vista" per la visita (finisce nell'indirizzo) e si rende predefinita da lì o da Impostazioni > Aspetto.

async function unlock(page: import("@playwright/test").Page) {
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
}

async function chooseView(page: import("@playwright/test").Page, name: RegExp) {
  await page.getByRole("button", { name: /^Vista:/ }).click();
  await page.getByRole("menuitemradio", { name }).click();
}

test("si passa da una vista all'altra dal menu, e ognuna mostra il documento a modo suo", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page, { filename: "polizza.pdf" });
  await page.getByRole("link", { name: /Torna all'archivio/ }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });

  // Di partenza c'è l'elenco.
  await expect(page.getByRole("button", { name: "Vista: Elenco" })).toBeVisible();
  await expect(page.getByRole("link", { name: "polizza.pdf" })).toBeVisible();

  // Cassettiera: una scheda con una casella di selezione, e la barra delle azioni compare selezionando.
  await chooseView(page, /Cassettiera/);
  await expect(page).toHaveURL(/vista=gallery/);
  await expect(page.getByRole("button", { name: "Vista: Cassettiera" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Apri polizza.pdf" })).toBeVisible();
  await page.getByRole("button", { name: "Seleziona polizza.pdf" }).click({ force: true });
  const bar = page.getByRole("toolbar", { name: "Azioni sui documenti selezionati" });
  await expect(bar).toContainText("1 selezionato");
  await bar.getByRole("button", { name: "Deseleziona tutto" }).click();
  await expect(bar).toHaveCount(0);

  // Linea del tempo: il documento sta nel suo mese, e c'è la mappa.
  await chooseView(page, /Linea del tempo/);
  await expect(page.getByRole("complementary", { name: "Mappa del tempo" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^polizza\.pdf/ })).toBeVisible();

  // Collezioni: dalla home alla tabella di una collezione.
  await chooseView(page, /Collezioni/);
  await expect(page.getByRole("region", { name: "Richiedono attenzione" })).toBeVisible();
  await page.getByRole("button", { name: /Apri Senza categoria, 1 documenti/ }).click();
  await expect(page.getByRole("link", { name: "polizza.pdf", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Archivio/ }).first().click();
  await expect(page.getByRole("region", { name: "Collezioni" })).toBeVisible();

  // Scaffale: un dorso, che si apre nel pannello.
  await chooseView(page, /Scaffale/);
  await page.getByRole("button", { name: "polizza.pdf" }).click();
  const panel = page.getByRole("complementary", { name: "Dettaglio del volume" });
  await expect(panel).toContainText("polizza.pdf");
  await expect(panel.getByRole("link", { name: "Apri" })).toBeVisible();

  // Tabella e di nuovo elenco: restano disponibili.
  await chooseView(page, /Tabella/);
  await expect(page.locator("table")).toBeVisible();
  await chooseView(page, /Elenco/);
  await expect(page.locator("table")).toHaveCount(0);
});

test("la vista predefinita si sceglie dal menu o da Impostazioni, e resta dopo un ricaricamento", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page, { filename: "polizza.pdf" });
  await page.getByRole("link", { name: /Torna all'archivio/ }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });

  // Dal menu: la vista scelta diventa quella di sempre.
  await chooseView(page, /Scaffale/);
  await page.getByRole("button", { name: "Vista: Scaffale" }).click();
  await page.getByRole("button", { name: "Rendi predefinita" }).click();
  await expect(page.getByText("Salvata ✓")).toBeVisible();
  await expect(page).not.toHaveURL(/vista=/);

  await page.reload();
  await unlock(page);
  await expect(page.getByRole("button", { name: "Vista: Scaffale" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Sfoglia lo scaffale")).toBeVisible();

  // Da Impostazioni > Aspetto > Liste si cambia, e l'Archivio si apre con la nuova.
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await page.getByRole("tab", { name: "Liste" }).click();
  const select = page.getByLabel("Vista predefinita dell'Archivio");
  await expect(select).toHaveValue("shelf");
  await select.selectOption("collections");
  await expect(select).toHaveValue("collections");

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await unlock(page);
  await expect(page.getByRole("button", { name: "Vista: Collezioni" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Richiedono attenzione" })).toBeVisible();

  // Un indirizzo con la vista scelta vince sulla predefinita, solo per quella visita.
  await page.goto("/archive?vista=table");
  await unlock(page);
  await expect(page.locator("table")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Vista: Tabella" })).toBeVisible();
});
