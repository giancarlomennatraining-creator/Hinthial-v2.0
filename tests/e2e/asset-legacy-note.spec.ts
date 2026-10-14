import { expect, test } from "./fixtures";
import { setUpWithDocument } from "./hinthia";
import { openArchiveTab } from "./nav";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// "Cosa succede a questo bene": una nota cifrata per ogni bene, che si scrive nel modulo del bene o nella pagina Eredità
// digitale. Richiede la colonna `assets.encrypted_legacy_note` (migrazione 20261016000001) sul database di prova.

test("ogni bene può dire cosa succede se non ci sei più: lo si scrive nel modulo e lo si rivede e cambia in Eredità digitale", async ({
  page,
}) => {
  test.slow();

  await setUpWithDocument(page);

  // Un bene con la nota, scritta nel modulo di creazione.
  await openArchiveTab(page, "Beni");
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill("Barca");
  await page.getByLabel(/Cosa succede a questo bene/).fill("Va a Luca. Le chiavi sono dal vicino.");
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  // E uno senza nota.
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill("Casa al mare");
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  // Nella pagina Eredità digitale: una riga a bene, la nota si vede, l'altra invita a scriverla.
  await page.getByRole("link", { name: "Eredità digitale", exact: true }).click();
  const beni = page.getByRole("region", { name: "I tuoi beni" });
  await expect(beni.getByText("Hai detto cosa succede a 1 bene su 2.")).toBeVisible({ timeout: 15_000 });
  await expect(beni.getByText("Va a Luca. Le chiavi sono dal vicino.")).toBeVisible();
  await expect(beni.getByText("Non hai detto cosa succede.")).toBeVisible();

  // Si scrive per l'altro bene da qui.
  await beni.getByRole("button", { name: "Scrivi cosa succede a Casa al mare" }).click();
  await beni.getByLabel("Cosa succede a Casa al mare").fill("Resta a Marta.");
  await beni.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(beni.getByText("Hai detto cosa succede a 2 beni su 2.")).toBeVisible({ timeout: 15_000 });
  await expect(beni.getByText("Resta a Marta.")).toBeVisible();

  // Si cambia, e svuotandola si toglie.
  await beni.getByRole("button", { name: "Cambia cosa succede a Barca" }).click();
  await beni.getByLabel("Cosa succede a Barca").fill("");
  await beni.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(beni.getByText("Hai detto cosa succede a 1 bene su 2.")).toBeVisible({ timeout: 15_000 });
});
