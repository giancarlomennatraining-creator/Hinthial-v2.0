import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// L'elenco delle capsule come buste: lo stato in vista e cosa manca a una bozza.

test("le capsule sono buste con lo stato in vista e cosa manca a una bozza", async ({ page }) => {
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
});
