import { expect, type Locator, type Page } from "@playwright/test";

/** Apre la ricerca globale (Ctrl+K) se non è già aperta, scrive la query e restituisce il dialog. */
export async function searchGlobally(page: Page, query: string): Promise<Locator> {
  const dialog = page.getByRole("dialog", { name: "Ricerca globale" });
  if (!(await dialog.isVisible())) {
    await page.keyboard.press("Control+KeyK");
    await expect(dialog).toBeVisible();
  }
  const input = dialog.getByLabel("Cerca", { exact: true });
  await input.fill(query);
  return dialog;
}

export async function closeGlobalSearch(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Ricerca globale" });
  if (await dialog.isVisible()) {
    await page.keyboard.press("Escape");
  }
  await expect(dialog).not.toBeVisible();
}
