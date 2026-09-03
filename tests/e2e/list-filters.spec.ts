import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

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

test("la ricerca e il filtro per categoria funzionano in Asset e Archivio", async ({ page }) => {
  test.slow();

  await loginAndSetUpEncryption(page);

  await page.getByRole("link", { name: "Asset" }).click();
  await page.getByRole("link", { name: "+ Crea asset" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo asset" })).toBeVisible();
  await page.getByLabel("Nome").fill("Appartamento");
  await page.locator("#categoryId").selectOption({ label: "🏠 Casa" });
  await page.getByRole("button", { name: "Aggiungi asset" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "+ Crea asset" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo asset" })).toBeVisible();
  await page.getByLabel("Nome").fill("Fiat Panda");
  await page.locator("#categoryId").selectOption({ label: "🚗 Veicoli" });
  await page.getByRole("button", { name: "Aggiungi asset" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });
  await expect(page.getByText("Appartamento")).toBeVisible();
  await expect(page.getByText("Fiat Panda")).toBeVisible();

  // Ricerca testuale.
  await page.getByPlaceholder("Cerca per nome…").fill("panda");
  await expect(page.getByText("Fiat Panda")).toBeVisible();
  await expect(page.getByText("Appartamento")).not.toBeVisible();
  await page.getByPlaceholder("Cerca per nome…").fill("");

  // Filtro per categoria.
  await page.getByLabel("Filtra per categoria").selectOption({ label: "🏠 Casa" });
  await expect(page.getByText("Appartamento")).toBeVisible();
  await expect(page.getByText("Fiat Panda")).not.toBeVisible();

  // Nessun risultato: messaggio esplicito, non una lista vuota muta.
  await page.getByLabel("Filtra per categoria").selectOption({ label: "Tutte le categorie" });
  await page.getByPlaceholder("Cerca per nome…").fill("xyzxyz");
  await expect(page.getByText("Nessun asset corrisponde alla ricerca.")).toBeVisible();

  // Archivio: stesso pattern (ricerca per nome + filtro categoria).
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.locator("#upload-category").selectOption({ label: "🛡️ Assicurazioni" });
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("polizza di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("polizza.txt")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.locator("#upload-category").selectOption({ label: "🏠 Casa" });
  await page.setInputFiles('input[type="file"]', {
    name: "contratto-affitto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contratto di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("contratto-affitto.txt")).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder("Cerca per nome, tag, note o trascrizione…").fill("polizza");
  await expect(page.getByText("polizza.txt")).toBeVisible();
  await expect(page.getByText("contratto-affitto.txt")).not.toBeVisible();
  await page.getByPlaceholder("Cerca per nome, tag, note o trascrizione…").fill("");

  await page.getByLabel("Filtra per categoria").selectOption({ label: "🏠 Casa" });
  await expect(page.getByText("contratto-affitto.txt")).toBeVisible();
  await expect(page.getByText("polizza.txt")).not.toBeVisible();
});

test("la ricerca e il filtro per stato funzionano in Scadenze, Contatti fiduciari e Capsule", async ({
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

  await page.getByPlaceholder("Cerca per titolo…").fill("passaporto");
  await expect(page.getByText("Rinnovo passaporto")).toBeVisible();
  await expect(page.getByText("Revisione auto")).not.toBeVisible();
  await page.getByPlaceholder("Cerca per titolo…").fill("");

  await page.getByLabel("Filtra per stato").selectOption({ label: "Completate" });
  await expect(page.getByText("Rinnovo passaporto")).toBeVisible();
  await expect(page.getByText("Revisione auto")).not.toBeVisible();

  await page.getByLabel("Filtra per stato").selectOption({ label: "Da completare" });
  await expect(page.getByText("Revisione auto")).toBeVisible();
  await expect(page.getByText("Rinnovo passaporto")).not.toBeVisible();

  // Contatti fiduciari: uno attivo, uno in attesa.
  await page.getByRole("link", { name: "Contatti", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contatto fiduciario" })).toBeVisible();
  await page.getByLabel("Nome").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi contatto" }).click();
  await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contatto fiduciario" })).toBeVisible();
  await page.getByLabel("Nome").fill("Luca Bianchi");
  await page.getByLabel("Email").fill("luca@esempio.it");
  await page.getByLabel("Ruolo").fill("Avvocato");
  await page.getByRole("button", { name: "Aggiungi contatto" }).click();
  await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });

  const mariaRow = page.getByRole("listitem").filter({ hasText: "Maria Rossi" });
  await openRowMenu(mariaRow);
  await page.getByRole("menuitem", { name: "Segna come attivo" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Maria Rossi" }).getByText("Attivo"),
  ).toBeVisible();

  await page.getByPlaceholder("Cerca per nome, email o ruolo…").fill("avvocato");
  await expect(page.getByText("Luca Bianchi")).toBeVisible();
  await expect(page.getByText("Maria Rossi")).not.toBeVisible();
  await page.getByPlaceholder("Cerca per nome, email o ruolo…").fill("");

  await page.getByLabel("Filtra per stato").selectOption({ label: "Attivi" });
  await expect(page.getByText("Maria Rossi")).toBeVisible();
  await expect(page.getByText("Luca Bianchi")).not.toBeVisible();

  // Capsule: una chiusa, una bozza.
  await page.getByRole("link", { name: "Capsule" }).click();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
  await page.getByLabel("Titolo").fill("Per Maria");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
  await page.getByLabel("Titolo").fill("Ricordi di famiglia");
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

  await page.getByPlaceholder("Cerca per titolo o contenuto…").fill("ricordi");
  await expect(page.getByText("Ricordi di famiglia")).toBeVisible();
  await expect(page.getByText("Per Maria")).not.toBeVisible();
  await page.getByPlaceholder("Cerca per titolo o contenuto…").fill("");

  await page.getByLabel("Filtra per stato").selectOption({ label: "Chiusa" });
  await expect(page.getByText("Per Maria")).toBeVisible();
  await expect(page.getByText("Ricordi di famiglia")).not.toBeVisible();
});
