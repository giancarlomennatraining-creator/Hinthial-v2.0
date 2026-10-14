import { expect, test } from "./fixtures";
import { MASTER_PASSWORD, setUpWithDocument } from "./hinthia";
import { openArchiveTab } from "./nav";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// "Fallo arrivare a…": da un documento, un fascicolo o un bene si parte da una capsula già avviata. Il punto di partenza
// viaggia nell'indirizzo come tipo e id (mai testo cifrato); titolo, lettera e allegati li ricostruisce il modulo.
// Richiede la colonna `assets.encrypted_legacy_note` (migrazione 20261016000001) e `capsules.open_on_legacy` (…000).

test("da un documento e da un bene si avvia una capsula con titolo, lettera e allegati già al loro posto", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page); // sulla scheda di polizza.pdf

  // Dal documento: titolo = nome del file, allegato = il documento, regola dell'eredità già accesa. Nessun testo nell'URL.
  await page.getByRole("link", { name: "Fallo arrivare a…" }).click();
  await expect(page).toHaveURL(/\/capsules\/new\?da=documento:[0-9a-f-]+$/, { timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "Stai preparando una capsula da" })).toContainText("il documento polizza.pdf");
  await expect(page.getByLabel("Titolo")).toHaveValue("polizza.pdf");
  await expect(page.getByRole("checkbox", { name: /Aprila anche prima, se non ci sono più/ })).toBeChecked();
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2038-03-12T10:00");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByLabel("Il tuo messaggio").fill("Questa è la polizza.");
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  const daDocumento = page.getByRole("listitem").filter({ hasText: "polizza.pdf" }).first();
  await expect(daDocumento.getByText("Anche prima, se non ci sono più")).toBeVisible({ timeout: 15_000 });

  // Da un bene con la nota: la nota diventa la lettera.
  await openArchiveTab(page, "Beni");
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill("Barca");
  await page.getByLabel(/Cosa succede a questo bene/).fill("Va a Luca. Le chiavi sono dal vicino.");
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Eredità digitale", exact: true }).click();
  const beni = page.getByRole("region", { name: "I tuoi beni" });
  await beni.getByRole("link", { name: "Fai arrivare Barca a qualcuno" }).click();
  await expect(page).toHaveURL(/\/capsules\/new\?da=bene:[0-9a-f-]+$/, { timeout: 15_000 });
  await expect(page.getByLabel("Titolo")).toHaveValue("Cosa succede a Barca");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2038-03-12T10:00");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByLabel("Il tuo messaggio")).toHaveValue("Va a Luca. Le chiavi sono dal vicino.");
});

test("un punto di partenza che non esiste più apre il modulo vuoto, senza errori", async ({ page }) => {
  test.slow();

  await setUpWithDocument(page);
  // Un indirizzo con un bene che non c'è: un ricaricamento blocca la cassaforte, che si sblocca dalla finestra.
  await page.goto("/capsules/new?da=bene:00000000-0000-0000-0000-000000000000");
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Titolo")).toHaveValue("");
  await expect(page.getByRole("status").filter({ hasText: "Stai preparando una capsula da" })).toHaveCount(0);
});
