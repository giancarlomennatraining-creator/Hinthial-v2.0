import { expect, test, type Page } from "./fixtures";
import { setUpWithDocument } from "./hinthia";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Prima di chiudere una capsula (irreversibile) si fa il punto: cosa c'è, cosa manca, cosa potrebbe andare storto.

async function createCapsule(page: Page, title: string, { letter, friend }: { letter?: string; friend?: string }) {
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
  await page.getByLabel("Titolo").fill(title);
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2038-03-12T10:00");
  if (friend) {
    await page.locator("#create-friend").selectOption({ label: friend });
    await page.getByRole("button", { name: "+ Aggiungi" }).click();
  }
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  if (letter) await page.getByLabel("Il tuo messaggio").fill(letter);
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
}

test("prima di chiudere una capsula si vedono le verifiche: una blocca, gli avvisi lasciano scegliere", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page);

  // Un amico senza account Hinthial (è solo in rubrica): avviso, non blocco.
  await page.getByRole("link", { name: "Amici", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Capsule", exact: true }).click();
  await createCapsule(page, "Capsula vuota", {});
  await createCapsule(page, "Per Maria", { letter: "Cara Maria, ti voglio bene.", friend: "Maria Rossi" });

  // Senza lettera né allegato non si può chiudere: la verifica blocca, e dice cosa fare.
  const vuota = page.getByRole("listitem").filter({ hasText: "Capsula vuota" });
  await expect(vuota.getByText("Manca una lettera o un allegato")).toBeVisible({ timeout: 15_000 });
  await openRowMenu(vuota);
  await page.getByRole("menuitem", { name: "Chiudi la capsula" }).click();
  const dialog = page.getByRole("dialog", { name: "Prima di chiudere la capsula" });
  await expect(dialog.getByRole("img", { name: "Manca" })).toBeVisible();
  await expect(dialog.getByText("Aggiungi almeno una delle due cose.")).toBeVisible();
  await expect(dialog.getByText("Nessun destinatario: potrai aprirla solo tu.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Chiudi la capsula" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Non ancora" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(vuota.getByText("Bozza")).toBeVisible();

  // Con una lettera e un amico senza account: un avviso, ma si può chiudere.
  const perMaria = page.getByRole("listitem").filter({ hasText: "Per Maria" });
  await expect(perMaria.getByText("Pronta da chiudere, 1 avviso")).toBeVisible();
  await openRowMenu(perMaria);
  await page.getByRole("menuitem", { name: "Chiudi la capsula" }).click();
  await expect(dialog.getByText("lettera di 5 parole")).toBeVisible();
  await expect(dialog.getByText("Maria Rossi non ha ancora un account Hinthial: non potrà aprirla.")).toBeVisible();
  await expect(dialog.getByText("Cara Maria, ti voglio bene.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Chiudi la capsula" })).toBeEnabled();

  // L'anteprima completa si apre sopra la finestra, e chiudendola si torna qui.
  await dialog.getByRole("button", { name: "Guarda come la vedrà chi la riceve" }).click();
  const anteprima = page.getByRole("dialog", { name: "Anteprima capsula" });
  await expect(anteprima.getByText("Cara Maria, ti voglio bene.")).toBeVisible();
  await anteprima.getByRole("button", { name: "Chiudi anteprima" }).click();
  await expect(anteprima).toHaveCount(0);
  await expect(dialog).toBeVisible();

  // Si chiude davvero.
  await dialog.getByRole("button", { name: "Chiudi la capsula" }).click();
  await expect(perMaria.getByText("Chiusa", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toHaveCount(0);
});
