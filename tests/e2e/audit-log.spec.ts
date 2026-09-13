import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("Impostazioni > Attività si interroga con filtri (data e tipo) e apre il dettaglio di un evento", async ({
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

  // Il login stesso è già un evento --- consultabile subito, senza
  // sbloccare la cifratura (è un registro tecnico in chiaro). Niente
  // caricamento automatico: serve premere "Trova".
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Attività" }).click();

  await expect(page.getByText("Imposta i filtri che ti interessano")).toBeVisible();
  await page.getByRole("button", { name: "Trova" }).click();
  await expect(page.getByText("Accesso effettuato")).toBeVisible();

  // Il metodo di login è tra i dettagli, visibili aprendo la riga.
  await page.getByText("Accesso effettuato").click();
  const detail = page.getByRole("dialog", { name: "Dettaglio attività" });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Password")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi" }).click();
  await expect(detail).not.toBeVisible();

  // Il filtro per categoria (scelta multipla) funziona in entrambe le direzioni.
  await page.getByRole("checkbox", { name: "Contenuti" }).check();
  await page.getByRole("button", { name: "Trova" }).click();
  await expect(page.getByText("Nessuna attività trovata con questi filtri.")).toBeVisible();
  await page.getByRole("checkbox", { name: "Contenuti" }).uncheck();
  await page.getByRole("checkbox", { name: "Accessi" }).check();
  await page.getByRole("button", { name: "Trova" }).click();
  await expect(page.getByText("Accesso effettuato")).toBeVisible();
  await page.getByRole("checkbox", { name: "Accessi" }).uncheck();

  // Configurare la cifratura e aggiungere un contenuto/bene/contatto
  // registrano a loro volta un evento --- verificabile tornando qui.
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

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("polizza di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Amici", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Attività" }).click();
  await page.getByRole("button", { name: "Trova" }).click();
  await expect(page.getByText("Contenuto aggiunto all'archivio")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Amico aggiunto")).toBeVisible();

  await page.getByRole("checkbox", { name: "Amici" }).check();
  await page.getByRole("button", { name: "Trova" }).click();
  await expect(page.getByText("Amico aggiunto")).toBeVisible();
  await expect(page.getByText("Contenuto aggiunto all'archivio")).not.toBeVisible();
});
