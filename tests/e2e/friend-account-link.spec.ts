import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("un amico collegato a un account si scollega da solo se gli si cambia l'email", async ({ page }) => {
  test.slow();

  const owner = uniqueTestUser();
  const linked = uniqueTestUser();
  await createConfirmedTestUser(owner);
  await createConfirmedTestUser(linked);

  await page.goto("/login");
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password").fill(owner.password);
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

  // Aggiunto con l'email di un account Hinthial già esistente ---
  // dovrebbe risultare collegato da solo, senza fare nulla apposta.
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await page.getByLabel("Nome visualizzato").fill("Amico Collegato");
  await page.getByLabel("Email").fill(linked.email);
  await page.getByLabel("Ruolo").fill("Amico");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });

  const row = page.locator("li", { hasText: "Amico Collegato" });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.getByTitle("Ha un account Hinthial")).toBeVisible({ timeout: 15_000 });

  // Cambiando l'email a qualcosa che non corrisponde più a nessun
  // account, il badge deve sparire --- non restare agganciato
  // all'account di prima (v. domain/friends/repository.ts, updateFriend).
  await row.getByRole("button", { name: /Azioni/ }).click();
  await page.getByRole("menuitem", { name: "Modifica" }).click();
  await expect(page.getByRole("heading", { name: "Modifica amico" })).toBeVisible();
  await page.getByLabel("Email").fill("indirizzo-diverso@esempio.it");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });

  const updatedRow = page.locator("li", { hasText: "Amico Collegato" });
  await expect(updatedRow).toBeVisible({ timeout: 10_000 });
  await expect(updatedRow.getByTitle("Ha un account Hinthial")).not.toBeVisible();
});
