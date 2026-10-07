import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Fasi, prossimi passi e persone di un fascicolo: tutto facoltativo, nulla compare finché non lo si aggiunge.

test("un fascicolo ha fasi, prossimi passi e persone, che si vedono anche nell'elenco", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page, { filename: "compromesso.pdf" });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await page.getByRole("link", { name: "+ Nuovo fascicolo" }).click();
  await page.getByLabel("Titolo").fill("Acquisto casa");
  await page.getByRole("button", { name: "Crea fascicolo" }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 20_000 });
  await page.getByRole("link", { name: /Acquisto casa/ }).click();
  await expect(page.getByRole("heading", { name: "Acquisto casa" })).toBeVisible();

  // Senza niente di scritto, la scheda offre solo i pulsanti per aggiungere.
  await expect(page.getByRole("region", { name: "Fasi" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Prossimi passi" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Coinvolti" })).toHaveCount(0);

  // Le fasi: da un modello, poi ci si sposta con un clic.
  await page.getByRole("button", { name: "+ Fasi" }).click();
  await page.getByRole("button", { name: "Acquisto casa", exact: true }).click();
  await page.getByRole("button", { name: "Salva le fasi" }).click();
  const fasi = page.getByRole("region", { name: "Fasi" });
  await expect(fasi).toContainText("Fase: Trattativa", { timeout: 15_000 });
  await fasi.getByRole("button", { name: /Mutuo/ }).click();
  await expect(fasi).toContainText("Fase: Mutuo", { timeout: 15_000 });
  await expect(fasi.getByRole("button", { name: /Mutuo/ })).toHaveAttribute("aria-current", "step");

  // Un passo con una data conta tra le prossime scadenze.
  await page.getByRole("button", { name: "+ Prossimi passi" }).click();
  const passi = page.getByRole("region", { name: "Prossimi passi" });
  await passi.getByLabel("Aggiungi un passo").fill("Fissare il rogito dal notaio");
  await passi.getByLabel("Giorno del passo (facoltativo)").fill("2027-12-18");
  await passi.getByRole("button", { name: "Aggiungi" }).click();
  await expect(passi).toContainText("1 da fare", { timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Prossime scadenze" })).toContainText("Fissare il rogito dal notaio");
  await passi.getByLabel("Fissare il rogito dal notaio: fatto").check();
  await expect(passi).toContainText("0 da fare", { timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Prossime scadenze" })).toHaveCount(0);

  // Le persone: nome e ruolo.
  await page.getByRole("button", { name: "+ Persone" }).click();
  const coinvolti = page.getByRole("region", { name: "Coinvolti" });
  await coinvolti.getByLabel("Nome della persona").fill("Notaio Rossi");
  await coinvolti.getByLabel("Ruolo della persona").fill("Studio notarile");
  await coinvolti.getByRole("button", { name: "Aggiungi" }).click();
  await expect(coinvolti).toContainText("Notaio Rossi", { timeout: 15_000 });
  await expect(coinvolti).toContainText("Studio notarile");

  // Nell'elenco la scheda del fascicolo dice a che fase si è.
  await page.getByRole("link", { name: "← Torna ai fascicoli" }).click();
  await expect(page.getByText("Fase 3 di 5 · Mutuo")).toBeVisible({ timeout: 15_000 });

  // Si tolgono le fasi: torna tutto com'era.
  await page.getByRole("link", { name: /Acquisto casa/ }).click();
  await page.getByRole("button", { name: "Modifica le fasi" }).click();
  await page.getByRole("button", { name: "Togli le fasi" }).click();
  await expect(page.getByRole("region", { name: "Fasi" })).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "+ Fasi" })).toBeVisible();
});
