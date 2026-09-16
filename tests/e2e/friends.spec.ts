import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("aggiunge un amico, ne segue lo stato e lo elimina", async ({ page }) => {
  // Real PBKDF2 (600,000 iterations, x2) in-browser during setup can push
  // this past the default 30s test timeout under load.
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Amici" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();

  await expect(page.getByRole("heading", { name: "Amici" })).toBeVisible();
  await expect(page.getByText("Nessun amico ancora")).toBeVisible();

  // Aggiunta: nasce con stato "In attesa".
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo amico" })).toBeVisible();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  // Presente ma volutamente lasciata deselezionata --- spuntarla invierebbe
  // un'email vera (Resend è configurato con una chiave reale anche nei
  // test), da non fare qui solo per verificare che il form la mostri.
  await expect(
    page.getByRole("checkbox", { name: "Invita questo amico su Hinthial" }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Aggiungi amico" }).click();

  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  await expect(page.getByText("Amico aggiunto.")).toBeVisible();
  const row = page.locator("li", { hasText: "Maria Rossi" });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.getByText("In attesa")).toBeVisible();
  await expect(row.getByText("maria.rossi@esempio.it · Coniuge")).toBeVisible();

  // "Segna come attivo": In attesa -> Attivo.
  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "Segna come attivo" }).click();
  await expect(row.getByText("Attivo")).toBeVisible({ timeout: 10_000 });
  await openRowMenu(row);
  await expect(page.getByRole("menuitem", { name: "Segna come attivo" })).not.toBeVisible();

  // "Revoca": Attivo -> Revocato. Non implementiamo ancora nessuno
  // sblocco automatico dei dati (FASE 7): revocare è solo un cambio di
  // stato registrato, non tocca alcun permesso reale.
  await page.getByRole("menuitem", { name: "Revoca" }).click();
  await expect(row.getByText("Revocato")).toBeVisible({ timeout: 10_000 });
  await openRowMenu(row);
  await expect(page.getByRole("menuitem", { name: "Revoca" })).not.toBeVisible();

  // Modifica: pagina dedicata (come la creazione) --- si può correggere
  // anche un amico già revocato.
  await page.getByRole("menuitem", { name: "Modifica" }).click();
  await expect(page).toHaveURL(/\/friends\/[^/]+\/edit$/);
  await expect(page.getByRole("heading", { name: "Modifica amico" })).toBeVisible();
  await page.getByLabel("Nome visualizzato").fill("Maria Bianchi");
  await page.getByLabel("Email").fill("maria.bianchi@esempio.it");
  await page.getByLabel("Ruolo").fill("Sorella");
  await page.getByRole("button", { name: "Salva modifiche" }).click();

  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  await expect(page.getByText("Amico aggiornato.")).toBeVisible();
  const updatedRow = page.locator("li", { hasText: "Maria Bianchi" });
  await expect(updatedRow).toBeVisible({ timeout: 10_000 });
  await expect(updatedRow.getByText("maria.bianchi@esempio.it · Sorella")).toBeVisible();
  // Lo stato non viene toccato dalla modifica.
  await expect(updatedRow.getByText("Revocato")).toBeVisible();

  // Eliminazione.
  page.once("dialog", (dialog) => dialog.accept());
  await openRowMenu(updatedRow);
  await page.getByRole("menuitem", { name: "Elimina" }).click();
  await expect(page.getByText("Nessun amico ancora")).toBeVisible({
    timeout: 10_000,
  });
});

test("nome e cognome riempiono da soli il nome visualizzato, finché non lo si tocca; senza foto mostra le iniziali", async ({
  page,
}) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Amici" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Amici" })).toBeVisible();

  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo amico" })).toBeVisible();

  const displayNameField = page.getByLabel("Nome visualizzato");
  await page.getByLabel("Nome", { exact: true }).fill("Giulia");
  await expect(displayNameField).toHaveValue("Giulia");
  await page.getByLabel("Cognome").fill("Verdi");
  await expect(displayNameField).toHaveValue("Giulia Verdi");

  // Toccato direttamente, non segue più nome/cognome.
  await displayNameField.fill("La mia amica Giulia");
  await page.getByLabel("Cognome").fill("Verdi-Neri");
  await expect(displayNameField).toHaveValue("La mia amica Giulia");

  await page.getByLabel("Email").fill("giulia@esempio.it");
  await page.getByLabel("Ruolo").fill("Amica");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();

  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  const row = page.locator("li", { hasText: "La mia amica Giulia" });
  await expect(row).toBeVisible({ timeout: 10_000 });
  // Nessuna foto caricata --- iniziali di nome/cognome (Giulia Verdi-Neri -> GV).
  await expect(row.getByText("GV", { exact: true })).toBeVisible();
});

test("segnare come guardiano un amico senza account collegato avvisa che non potrà essere avvisato", async ({
  page,
}) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Amici" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Amici" })).toBeVisible();

  // Un amico "di rubrica", mai collegato a un account reale.
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await page.getByLabel("Nome visualizzato").fill("Luca Neri");
  await page.getByLabel("Email").fill("luca.neri@esempio.it");
  await page.getByLabel("Ruolo").fill("Fratello");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });

  const row = page.locator("li", { hasText: "Luca Neri" });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.getByText("✓ Su Hinthial")).not.toBeVisible();

  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "Segna come guardiano" }).click();
  await expect(
    page.getByText("Guardiano aggiunto --- non potrà essere avvisato finché non collega il suo account Hinthial."),
  ).toBeVisible();
  await expect(row.getByText("🛡️ Guardiano (non collegato)")).toBeVisible();

  // Rimuoverlo funziona come sempre, senza alcun avviso.
  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "Rimuovi dai guardiani" }).click();
  await expect(row.getByText("🛡️ Guardiano (non collegato)")).not.toBeVisible();
});
