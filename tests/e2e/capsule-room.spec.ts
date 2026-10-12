import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// L'elenco delle capsule come buste: lo stato in vista, cosa manca a una bozza, i filtri e la linea del futuro.

test("le capsule sono buste con lo stato in vista, i filtri e la linea del futuro", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page);

  await page.getByRole("link", { name: "Capsule", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();

  // Una bozza con la data tra anni e senza destinatario né lettera.
  await page.getByLabel("Titolo").fill("Per i miei 60 anni");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2038-03-12T10:00");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });

  const busta = page.getByRole("listitem").filter({ hasText: "Per i miei 60 anni" });
  await expect(busta).toBeVisible({ timeout: 15_000 });
  await expect(busta.getByText("Bozza")).toBeVisible();
  await expect(busta.getByText("Manca una lettera o un allegato")).toBeVisible();

  // I filtri sono pillole con i conteggi.
  const filtri = page.getByRole("group", { name: "Filtra per stato" });
  await expect(filtri.getByRole("button", { name: /^Tutte\s*1$/ })).toBeVisible();
  await expect(filtri.getByRole("button", { name: /^Bozza\s*1$/ })).toBeVisible();
  await expect(filtri.getByRole("button", { name: /^Chiusa\s*0$/ })).toBeVisible();
  await expect(filtri.getByRole("button", { name: /^Si aprono presto\s*0$/ })).toBeVisible();

  // La linea del futuro mostra la tappa con il titolo e la data.
  const linea = page.getByRole("region", { name: "Quando si apriranno" });
  await expect(linea).toContainText("Oggi");
  await expect(linea).toContainText("Per i miei 60 anni");
  await expect(linea).toContainText("2038");

  // Un filtro che non lascia nulla toglie anche la linea.
  await filtri.getByRole("button", { name: /^Chiusa/ }).click();
  await expect(page.getByText("Nessuna capsula corrisponde ai filtri.")).toBeVisible();
  await expect(linea).toHaveCount(0);

  await filtri.getByRole("button", { name: /^Bozza/ }).click();
  await expect(busta).toBeVisible();
  await expect(page.getByRole("region", { name: "Quando si apriranno" })).toBeVisible();
});
