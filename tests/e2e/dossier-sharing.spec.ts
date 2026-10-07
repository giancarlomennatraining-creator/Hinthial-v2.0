import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Condividere un fascicolo con un link protetto: chi condivide crea il link, chi lo riceve (senza account) apre i
// documenti nel browser, chi condivide vede gli accessi e può revocare.

test("si condivide un fascicolo con un link protetto, lo si apre senza account, e lo si revoca", async ({ page, browser }) => {
  test.slow();

  await setUpWithDocument(page, { filename: "atto-vendita.pdf" });

  // Il fascicolo, e il documento dentro.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await page.getByRole("link", { name: "+ Nuovo fascicolo" }).click();
  await page.getByLabel("Titolo").fill("Acquisto casa");
  await page.getByLabel("Descrizione").fill("Appartamento di Via Roma 12");
  await page.getByRole("button", { name: "Crea fascicolo" }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 20_000 });
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: /atto-vendita\.pdf/ }).click();
  await page.getByRole("tab", { name: "Scheda" }).click();
  await page.getByLabel("Fascicoli").selectOption({ label: "📂 Acquisto casa" });
  await page.getByRole("button", { name: "+ Aggiungi fascicolo" }).click();
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByRole("button", { name: "Salva modifiche" })).toBeDisabled({ timeout: 20_000 });

  // Si crea il link: solo lettura, 24 ore, per un notaio.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await page.getByRole("link", { name: /Acquisto casa/ }).click();
  await page.getByRole("link", { name: "Condividi" }).click();
  await expect(page.getByRole("heading", { name: "Condividi un fascicolo" })).toBeVisible();
  await expect(page.getByLabel("Condividi atto-vendita.pdf")).toBeChecked();
  await page.getByRole("button", { name: "Notaio", exact: true }).click();
  await page.getByLabel("24 ore").check();
  await page.getByRole("button", { name: "Crea il link protetto" }).click();
  const pronto = page.getByRole("region", { name: "Link pronto" });
  await expect(pronto).toContainText("Link pronto per Notaio", { timeout: 30_000 });
  const url = await pronto.getByLabel("Link di condivisione").inputValue();
  expect(url).toMatch(/\/c\/[0-9a-f-]{36}#[A-Za-z0-9_-]{43}$/);

  // Chi riceve il link non ha un account: un browser nuovo, senza sessione.
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(url);
  await expect(guestPage.getByRole("heading", { name: "Acquisto casa" })).toBeVisible({ timeout: 20_000 });
  await expect(guestPage.getByText("Appartamento di Via Roma 12")).toBeVisible();
  await expect(guestPage.getByText("solo lettura")).toBeVisible();
  await expect(guestPage.getByText("atto-vendita.pdf")).toBeVisible();
  await expect(guestPage.getByRole("button", { name: /^Scarica/ })).toHaveCount(0);

  // Apre il documento: viene decifrato nel suo browser.
  await guestPage.getByRole("button", { name: "Apri atto-vendita.pdf" }).click();
  const viewer = guestPage.getByRole("dialog", { name: "atto-vendita.pdf" });
  await expect(viewer.locator("iframe")).toBeVisible({ timeout: 20_000 });
  await viewer.getByRole("button", { name: "Chiudi" }).click();

  // Senza la chiave (la parte dopo il #) non vede niente.
  const noKey = await guest.newPage();
  await noKey.goto(url.split("#")[0]);
  await expect(noKey.getByText(/Il link è incompleto/)).toBeVisible({ timeout: 15_000 });

  // Chi ha condiviso vede gli accessi e può revocare.
  await page.getByRole("link", { name: /Acquisto casa/ }).first().click();
  await page.getByRole("link", { name: "Condividi" }).click();
  const link = page.getByRole("region", { name: "Link condivisi" });
  await expect(link).toContainText("Notaio", { timeout: 15_000 });
  await expect(link).toContainText("Attivo");
  await expect(link).toContainText("1 documento visto");
  page.once("dialog", (dialog) => dialog.accept());
  await link.getByRole("button", { name: "Revoca subito" }).click();
  await expect(link).toContainText("Revocato", { timeout: 20_000 });

  // Da ora il link non apre più niente.
  const after = await guest.newPage();
  await after.goto(url);
  await expect(after.getByText(/scaduto o è stato revocato/)).toBeVisible({ timeout: 15_000 });

  await guest.close();
});
