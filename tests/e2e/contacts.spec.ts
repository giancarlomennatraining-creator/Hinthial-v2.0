import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("aggiunge un contatto fiduciario, ne segue lo stato e lo elimina", async ({ page }) => {
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

  await page.getByRole("link", { name: "Contatti" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();

  await expect(page.getByRole("heading", { name: "Contatti fiduciari" })).toBeVisible();
  await expect(page.getByText("Nessun contatto fiduciario ancora")).toBeVisible();

  // Aggiunta: nasce con stato "In attesa".
  await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contatto fiduciario" })).toBeVisible();
  await page.getByLabel("Nome").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi contatto" }).click();

  await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });
  await expect(page.getByText("✅ Contatto aggiunto.")).toBeVisible();
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

  // Modifica: si può correggere anche un contatto già revocato.
  await page.getByRole("menuitem", { name: "Modifica" }).click();
  await page.locator('[id^="edit-"][id$="-name"]').fill("Maria Bianchi");
  await page.locator('[id^="edit-"][id$="-email"]').fill("maria.bianchi@esempio.it");
  await page.locator('[id^="edit-"][id$="-role"]').fill("Sorella");
  await page.getByRole("button", { name: "Salva" }).click();

  const updatedRow = page.locator("li", { hasText: "Maria Bianchi" });
  await expect(updatedRow).toBeVisible({ timeout: 10_000 });
  await expect(updatedRow.getByText("maria.bianchi@esempio.it · Sorella")).toBeVisible();
  // Lo stato non viene toccato dalla modifica.
  await expect(updatedRow.getByText("Revocato")).toBeVisible();

  // Eliminazione.
  page.once("dialog", (dialog) => dialog.accept());
  await openRowMenu(updatedRow);
  await page.getByRole("menuitem", { name: "Elimina" }).click();
  await expect(page.getByText("Nessun contatto fiduciario ancora")).toBeVisible({
    timeout: 10_000,
  });
});
