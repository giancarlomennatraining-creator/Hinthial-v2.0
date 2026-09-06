import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("Impostazioni > Privacy mostra dati reali dell'account e non richiede la master key", async ({
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

  // Consultabile subito, prima ancora di configurare la cifratura.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Privacy" }).click();

  await expect(page.getByRole("heading", { name: "Cosa sa Hinthial di te" })).toBeVisible();
  await expect(page.getByText(`La tua email: ${user.email}`)).toBeVisible();
  await expect(page.getByText(`Nome e cognome: ${fullName(user)}`)).toBeVisible();
  await expect(page.getByText("0 contenuti in archivio")).toBeVisible();
  await expect(page.getByText("0 asset")).toBeVisible();
  await expect(page.getByText(/^Disposizione del menu: /)).toBeVisible();
  await expect(page.getByText("Il contenuto dei tuoi documenti, foto, audio e video")).toBeVisible();
  await expect(
    page.getByText("La tua master password --- non lascia mai il tuo dispositivo"),
  ).toBeVisible();

  // Configurare la cifratura e aggiungere contenuti aggiorna i conteggi.
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
  await page.locator("#upload-category").selectOption({ label: "🛡️ Assicurazioni" });
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("polizza di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Privacy" }).click();
  await expect(page.getByText("1 contenuti in archivio")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Le tue categorie: .*Assicurazioni/)).toBeVisible();

  // Il nome del file --- unico dettaglio davvero sensibile qui --- non
  // compare mai in questa pagina, solo il conteggio.
  await expect(page.getByText("polizza.txt")).not.toBeVisible();
});
