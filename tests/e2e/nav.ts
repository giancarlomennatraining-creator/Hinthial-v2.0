import { expect, type Page } from "@playwright/test";

/**
 * Apre una scheda dell'Archivio (Contenuti, Fascicoli, Beni, Scadenze) dal punto in cui si è: se la barra delle
 * schede non c'è ancora si passa dalla voce "Archivio" del menu. Beni e Scadenze non sono più voci di menu a sé.
 */
export async function openArchiveTab(page: Page, label: "Contenuti" | "Fascicoli" | "Beni" | "Scadenze") {
  const tab = page.getByRole("navigation", { name: "Sezioni dell'Archivio" }).getByRole("link", { name: label, exact: true });
  if (!(await tab.isVisible())) {
    await page.getByRole("link", { name: "Archivio", exact: true }).click();
    await expect(tab).toBeVisible({ timeout: 15_000 });
  }
  await tab.click();
}
