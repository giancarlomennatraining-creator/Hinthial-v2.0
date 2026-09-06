import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("Impostazioni > Attività mostra il registro degli eventi, raggruppato per giorno e filtrabile per tipo", async ({
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
  // sbloccare la cifratura (è un registro tecnico in chiaro).
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Attività" }).click();

  await expect(page.getByText("Oggi")).toBeVisible();
  await expect(page.getByText("Accesso effettuato")).toBeVisible();

  // Il filtro per categoria funziona in entrambe le direzioni.
  await page.getByRole("radio", { name: "Accessi" }).click();
  await expect(page.getByText("Accesso effettuato")).toBeVisible();
  await page.getByRole("radio", { name: "Contenuti" }).click();
  await expect(page.getByText("Nessuna attività di questo tipo.")).toBeVisible();
  await page.getByRole("radio", { name: "Tutti" }).click();
  await expect(page.getByText("Accesso effettuato")).toBeVisible();

  // Configurare la cifratura, aggiungere un contenuto e un contatto
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

  await page.getByRole("link", { name: "Contatti", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
  await page.getByLabel("Nome").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi contatto" }).click();
  await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Attività" }).click();
  await expect(page.getByText("Contenuto aggiunto all'archivio")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Contatto fiduciario aggiunto")).toBeVisible();

  await page.getByRole("radio", { name: "Contatti" }).click();
  await expect(page.getByText("Contatto fiduciario aggiunto")).toBeVisible();
  await expect(page.getByText("Contenuto aggiunto all'archivio")).not.toBeVisible();
});
