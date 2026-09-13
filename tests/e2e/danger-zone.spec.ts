import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("\"Cancella tutto\" svuota Archivio, Beni, Amici e Capsule, ripristina le categorie predefinite, e non tocca le Scadenze", async ({
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

  // Master key + una categoria personalizzata, oltre alle 10 predefinite.
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

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Categorie" }).click();
  await page.getByLabel("Icona").fill("🎯");
  await page.getByLabel("Nome").fill("Hobby");
  await page.getByRole("button", { name: "Aggiungi categoria" }).click();
  await expect(page.getByText("🎯 Hobby")).toBeVisible({ timeout: 10_000 });

  // Un contenuto in Archivio.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("polizza di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("polizza.txt")).toBeVisible({ timeout: 15_000 });

  // Un bene.
  await page.getByRole("link", { name: "Beni" }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo bene" })).toBeVisible();
  await page.getByLabel("Nome").fill("Appartamento");
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });
  await expect(page.getByText("Appartamento")).toBeVisible({ timeout: 10_000 });

  // Una scadenza --- non deve sparire, solo scollegarsi dal bene.
  await page.getByRole("link", { name: "Scadenze" }).click();
  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  await expect(page.getByRole("heading", { name: "Nuova scadenza" })).toBeVisible();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Titolo").fill("Pagamento IMU");
  await page.getByLabel("Data").fill(future);
  await page.getByLabel("Bene collegato").selectOption({ label: "Appartamento" });
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();
  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });
  await expect(page.getByText("Pagamento IMU")).toBeVisible({ timeout: 10_000 });

  // Un amico.
  await page.getByRole("link", { name: "Amici" }).click();
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo amico" })).toBeVisible();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  await expect(page.getByText("Maria Rossi")).toBeVisible({ timeout: 10_000 });

  // Una capsula.
  await page.getByRole("link", { name: "Capsule" }).click();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
  await page.getByLabel("Titolo").fill("Per Maria");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2027-01-01T10:00");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("Per Maria")).toBeVisible({ timeout: 10_000 });

  // "Reimposta l'account" (prima "Cancella tutto").
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Zona pericolosa" }).click();
  await expect(page.getByRole("heading", { name: "Reimposta l'account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cancella il tuo account" })).toBeVisible();

  await page.getByRole("button", { name: "Reimposta account" }).click();
  const dialog = page.getByRole("dialog", { name: "Conferma reimpostazione account" });
  await expect(dialog).toBeVisible();

  const confirmButton = dialog.getByRole("button", { name: "Reimposta definitivamente" });
  await expect(confirmButton).toBeDisabled();
  await dialog.getByLabel("Master password").fill("una-master-password-solida");
  await expect(confirmButton).toBeDisabled();
  await dialog.getByLabel(/Scrivi REIMPOSTA TUTTO/).fill("qualcosa di sbagliato");
  await expect(confirmButton).toBeDisabled();
  await dialog.getByLabel(/Scrivi REIMPOSTA TUTTO/).fill("REIMPOSTA TUTTO");
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(page.getByText("Il vault è stato svuotato.")).toBeVisible({ timeout: 15_000 });

  // Archivio, Beni, Amici e Capsule sono vuoti.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page.getByText("Ancora nulla in archivio.")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Beni" }).click();
  await expect(page.getByText("Nessun bene ancora")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Amici" }).click();
  await expect(page.getByText("Nessun amico ancora")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByText("Nessuna capsula ancora")).toBeVisible({ timeout: 10_000 });

  // Le categorie sono di nuovo le 10 predefinite --- non più "Hobby".
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Categorie" }).click();
  await expect(page.getByText("👤 Personale")).toBeVisible();
  await expect(page.getByText("📦 Altro")).toBeVisible();
  await expect(page.getByText("🎯 Hobby")).not.toBeVisible();

  // La scadenza resta --- solo scollegata dal bene ormai cancellato.
  await page.getByRole("link", { name: "Scadenze" }).click();
  await expect(page.getByText("Pagamento IMU")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("🔗 Appartamento")).not.toBeVisible();
});

test("\"Cancella il tuo account\" richiede la master password corretta, poi cancella per sempre l'account (non si può più accedere)", async ({
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

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Zona pericolosa" }).click();

  await page.getByRole("button", { name: "Cancella account" }).click();
  const dialog = page.getByRole("dialog", { name: "Conferma cancellazione account" });
  await expect(dialog).toBeVisible();

  const confirmButton = dialog.getByRole("button", { name: "Cancella definitivamente" });
  await dialog.getByLabel("Master password").fill("password sbagliata");
  await dialog.getByLabel(/Scrivi CANCELLA ACCOUNT/).fill("CANCELLA ACCOUNT");
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();
  await expect(dialog.getByText("Master password non corretta.")).toBeVisible();
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Master password").fill("una-master-password-solida");
  await confirmButton.click();

  await expect(page).toHaveURL("/", { timeout: 15_000 });

  // L'account non esiste più: lo stesso login fallisce ora.
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByText("Email o password non corretti.")).toBeVisible();
});
