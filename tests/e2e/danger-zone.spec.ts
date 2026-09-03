import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("\"Cancella tutto\" svuota Archivio, Asset, Contatti e Capsule, ripristina le categorie predefinite, e non tocca le Scadenze", async ({
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

  // Un asset.
  await page.getByRole("link", { name: "Asset" }).click();
  await page.getByRole("link", { name: "+ Crea asset" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo asset" })).toBeVisible();
  await page.getByLabel("Nome").fill("Appartamento");
  await page.getByRole("button", { name: "Aggiungi asset" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });
  await expect(page.getByText("Appartamento")).toBeVisible({ timeout: 10_000 });

  // Una scadenza --- non deve sparire, solo scollegarsi dall'asset.
  await page.getByRole("link", { name: "Scadenze" }).click();
  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  await expect(page.getByRole("heading", { name: "Nuova scadenza" })).toBeVisible();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Titolo").fill("Pagamento IMU");
  await page.getByLabel("Data").fill(future);
  await page.getByLabel("Asset collegato").selectOption({ label: "Appartamento" });
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();
  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });
  await expect(page.getByText("Pagamento IMU")).toBeVisible({ timeout: 10_000 });

  // Un contatto fiduciario.
  await page.getByRole("link", { name: "Contatti" }).click();
  await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contatto fiduciario" })).toBeVisible();
  await page.getByLabel("Nome").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi contatto" }).click();
  await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });
  await expect(page.getByText("Maria Rossi")).toBeVisible({ timeout: 10_000 });

  // Una capsula.
  await page.getByRole("link", { name: "Capsule" }).click();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
  await page.getByLabel("Titolo").fill("Per Maria");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("Per Maria")).toBeVisible({ timeout: 10_000 });

  // "Cancella tutto".
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Zona pericolosa" }).click();
  await expect(page.getByRole("heading", { name: "Zona pericolosa" })).toBeVisible();

  await page.getByRole("button", { name: "Cancella tutto" }).click();
  const dialog = page.getByRole("dialog", { name: "Conferma cancellazione totale" });
  await expect(dialog).toBeVisible();

  const confirmButton = dialog.getByRole("button", { name: "Elimina definitivamente" });
  await expect(confirmButton).toBeDisabled();
  await dialog.getByLabel(/Scrivi ELIMINA TUTTO/).fill("qualcosa di sbagliato");
  await expect(confirmButton).toBeDisabled();
  await dialog.getByLabel(/Scrivi ELIMINA TUTTO/).fill("ELIMINA TUTTO");
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(page.getByText("✅ Tutti i dati sono stati eliminati.")).toBeVisible({ timeout: 15_000 });

  // Archivio, Asset, Contatti e Capsule sono vuoti.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page.getByText("Ancora nulla in archivio.")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Asset" }).click();
  await expect(page.getByText("Nessun asset ancora")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Contatti" }).click();
  await expect(page.getByText("Nessun contatto fiduciario ancora")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByText("Nessuna capsula ancora")).toBeVisible({ timeout: 10_000 });

  // Le categorie sono di nuovo le 10 predefinite --- non più "Hobby".
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Categorie" }).click();
  await expect(page.getByText("👤 Personale")).toBeVisible();
  await expect(page.getByText("📦 Altro")).toBeVisible();
  await expect(page.getByText("🎯 Hobby")).not.toBeVisible();

  // La scadenza resta --- solo scollegata dall'asset ormai cancellato.
  await page.getByRole("link", { name: "Scadenze" }).click();
  await expect(page.getByText("Pagamento IMU")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("🔗 Appartamento")).not.toBeVisible();
});
