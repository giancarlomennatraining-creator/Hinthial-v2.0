import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";
import { closeGlobalSearch, searchGlobally } from "./search-helpers";

// Requires a configured Supabase project (.env.local) --- see README.md.

async function loginAndSetUpEncryption(page: import("@playwright/test").Page) {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  return user;
}

test("la ricerca globale e il filtro per categoria funzionano in Beni e Archivio", async ({ page }) => {
  test.slow();

  await loginAndSetUpEncryption(page);

  await page.getByRole("link", { name: "Beni" }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo bene" })).toBeVisible();
  await page.getByLabel("Nome").fill("Appartamento");
  await page.locator("#categoryId").selectOption({ label: "🏠 Casa" });
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo bene" })).toBeVisible();
  await page.getByLabel("Nome").fill("Fiat Panda");
  await page.locator("#categoryId").selectOption({ label: "🚗 Veicoli" });
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });
  await expect(page.getByText("Appartamento")).toBeVisible();
  await expect(page.getByText("Fiat Panda")).toBeVisible();

  // Ricerca: le aree non hanno più il proprio campo, c'è la ricerca globale.
  await expect(page.getByPlaceholder("Cerca per nome…")).toHaveCount(0);
  const assetsSearch = await searchGlobally(page, "panda");
  await expect(assetsSearch.getByRole("button", { name: /Fiat Panda/ })).toBeVisible();
  await expect(assetsSearch.getByRole("button", { name: /Appartamento/ })).toHaveCount(0);
  await closeGlobalSearch(page);

  // Filtro per categoria.
  await page.getByLabel("Filtra per categoria").selectOption({ label: "🏠 Casa" });
  await expect(page.getByText("Appartamento")).toBeVisible();
  await expect(page.getByText("Fiat Panda")).not.toBeVisible();

  // Archivio: stesso pattern (ricerca per nome + filtro categoria).
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  // Il passo 1 non parte più su una modalità già scelta (v. feedback utente): va scelta esplicitamente.
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("polizza di prova"),
  });
  await page.getByRole("button", { name: "Dettagli" }).click();
  await page.locator("#upload-category").selectOption({ label: "🛡️ Assicurazioni" });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("polizza.txt")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  // Il passo 1 non parte più su una modalità già scelta (v. feedback utente): va scelta esplicitamente.
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "contratto-affitto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contratto di prova"),
  });
  await page.getByRole("button", { name: "Dettagli" }).click();
  await page.locator("#upload-category").selectOption({ label: "🏠 Casa" });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("contratto-affitto.txt")).toBeVisible({ timeout: 15_000 });

  await expect(page.getByPlaceholder(/Cerca per nome, tag, note/)).toHaveCount(0);
  const archiveSearch = await searchGlobally(page, "polizza");
  await expect(archiveSearch.getByRole("button", { name: /polizza\.txt/ })).toBeVisible();
  await expect(archiveSearch.getByRole("button", { name: /contratto-affitto\.txt/ })).toHaveCount(0);
  await closeGlobalSearch(page);

  await page.getByLabel("Filtra per categoria").selectOption({ label: "🏠 Casa" });
  await expect(page.getByText("contratto-affitto.txt")).toBeVisible();
  await expect(page.getByText("polizza.txt")).not.toBeVisible();
});

test("la ricerca globale e il filtro per stato funzionano in Scadenze, Amici e Capsule", async ({
  page,
}) => {
  test.slow();

  await loginAndSetUpEncryption(page);

  // Scadenze: una completata, una no.
  await page.getByRole("link", { name: "Scadenze" }).click();
  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  await expect(page.getByRole("heading", { name: "Nuova scadenza" })).toBeVisible();
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Titolo").fill("Rinnovo passaporto");
  await page.getByLabel("Data").fill(future);
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();
  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  await expect(page.getByRole("heading", { name: "Nuova scadenza" })).toBeVisible();
  await page.getByLabel("Titolo").fill("Revisione auto");
  await page.getByLabel("Data").fill(future);
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();
  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });

  await page
    .getByRole("listitem")
    .filter({ hasText: "Rinnovo passaporto" })
    .getByRole("checkbox")
    .click();
  await expect(page.getByText("Rinnovo passaporto")).toHaveClass(/line-through/);

  const remindersSearch = await searchGlobally(page, "passaporto");
  await expect(remindersSearch.getByRole("button", { name: /Rinnovo passaporto/ })).toBeVisible();
  await expect(remindersSearch.getByRole("button", { name: /Revisione auto/ })).toHaveCount(0);
  await closeGlobalSearch(page);

  await page.getByLabel("Filtra per stato").selectOption({ label: "Completate" });
  await expect(page.getByText("Rinnovo passaporto")).toBeVisible();
  await expect(page.getByText("Revisione auto")).not.toBeVisible();

  await page.getByLabel("Filtra per stato").selectOption({ label: "Da completare" });
  await expect(page.getByText("Revisione auto")).toBeVisible();
  await expect(page.getByText("Rinnovo passaporto")).not.toBeVisible();

  // Amici: uno attivo, uno revocato.
  await page.getByRole("link", { name: "Amici", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo amico" })).toBeVisible();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo amico" })).toBeVisible();
  await page.getByLabel("Nome visualizzato").fill("Luca Bianchi");
  await page.getByLabel("Email").fill("luca@esempio.it");
  await page.getByLabel("Ruolo").fill("Avvocato");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });

  const rubrica = page.getByRole("region", { name: "Rubrica" });
  await rubrica.getByRole("button", { name: /Luca Bianchi/ }).click();
  const lucaScheda = page.getByRole("region", { name: "Scheda di Luca Bianchi" });
  await openRowMenu(lucaScheda);
  await page.getByRole("menuitem", { name: "Revoca" }).click();
  await expect(lucaScheda.getByText("Revocato")).toBeVisible();

  const friendsSearch = await searchGlobally(page, "avvocato");
  await expect(friendsSearch.getByRole("button", { name: /Luca Bianchi/ })).toBeVisible();
  await expect(friendsSearch.getByRole("button", { name: /Maria Rossi/ })).toHaveCount(0);
  await closeGlobalSearch(page);

  await page.getByLabel("Filtra per stato").selectOption({ label: "Attivi" });
  await expect(rubrica.getByRole("button", { name: /Maria Rossi/ })).toBeVisible();
  await expect(rubrica.getByRole("button", { name: /Luca Bianchi/ })).toHaveCount(0);

  // Capsule: una chiusa, una bozza.
  await page.getByRole("link", { name: "Capsule" }).click();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
  await page.getByLabel("Titolo").fill("Per Maria");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2027-01-01T10:00");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
  await page.getByLabel("Titolo").fill("Ricordi di famiglia");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2027-01-01T10:00");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });

  const perMariaRow = page.getByRole("listitem").filter({ hasText: "Per Maria" });
  page.once("dialog", (dialog) => dialog.accept());
  await openRowMenu(perMariaRow);
  await page.getByRole("menuitem", { name: "Chiudi la capsula" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Per Maria" }).getByText("Chiusa"),
  ).toBeVisible();

  const capsulesSearch = await searchGlobally(page, "ricordi");
  await expect(capsulesSearch.getByRole("button", { name: /Ricordi di famiglia/ })).toBeVisible();
  await expect(capsulesSearch.getByRole("button", { name: /Per Maria/ })).toHaveCount(0);
  await closeGlobalSearch(page);

  await page.getByLabel("Filtra per stato").selectOption({ label: "Chiusa" });
  await expect(page.getByText("Per Maria")).toBeVisible();
  await expect(page.getByText("Ricordi di famiglia")).not.toBeVisible();
});
