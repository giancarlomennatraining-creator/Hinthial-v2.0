import { expect, test } from "./fixtures";
import { buildPdf, POLIZZA, setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// La zona di rilascio del file ("Mirino"): a riposo, con un file che ci passa sopra, mentre si legge, a lettura finita;
// poi lascia il posto alla scheda del file, e rimuovendolo torna a riposo.

test("la zona di rilascio reagisce al trascinamento e al caricamento del file", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page, { filename: "primo.pdf" });
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await page.getByRole("radio", { name: /Carica un file/ }).click();

  const zone = page.locator(".file-drop");
  await expect(zone).toHaveAttribute("data-state", "idle");
  await expect(zone).toContainText("Trascina qui un documento, o clicca per sceglierlo");

  // Un file che ci passa sopra (si tiene premuto il tasto del mouse): il riquadro si accorge e cambia, e quando esce torna a riposo.
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await zone.dispatchEvent("dragenter", { dataTransfer });
  await expect(zone).toHaveAttribute("data-state", "over");
  await expect(zone).toContainText("Inquadrato: rilascia");
  await zone.dispatchEvent("dragleave", { dataTransfer });
  await expect(zone).toHaveAttribute("data-state", "idle");

  // Scelto il file: il riquadro lo legge (e poi dice "Fatto"), poi lascia il posto alla scheda del file.
  await page.setInputFiles('input[type="file"]', { name: "secondo.pdf", mimeType: "application/pdf", buffer: buildPdf(POLIZZA) });
  await expect(zone).toHaveAttribute("data-state", /loading|done/);
  await expect(page.getByText("Letto sul dispositivo")).toBeVisible({ timeout: 30_000 });
  await expect(zone).toHaveCount(0);
  await expect(page.getByText("secondo.pdf")).toBeVisible();

  // Rimuovendo il file la zona torna a riposo, pronta per un altro.
  await page.getByRole("button", { name: "Rimuovi file" }).click();
  await expect(page.locator(".file-drop")).toHaveAttribute("data-state", "idle");
});
