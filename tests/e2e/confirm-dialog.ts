import { expect, type Page } from "@playwright/test";

/**
 * La conferma dell'app (v. ConfirmProvider) al posto della finestra del browser: aspetta che compaia, ne restituisce il
 * testo (per chi vuole controllarlo) e la accetta, o la rifiuta con `dismiss`.
 */
export async function acceptConfirm(page: Page, { dismiss = false }: { dismiss?: boolean } = {}): Promise<string> {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const message = (await dialog.textContent()) ?? "";
  if (dismiss) await dialog.getByRole("button", { name: "Annulla" }).click();
  else await dialog.locator('[data-confirm="accept"]').click();
  await expect(dialog).toBeHidden({ timeout: 5_000 });
  return message;
}
