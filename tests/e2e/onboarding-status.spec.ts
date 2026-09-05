import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("l'indicatore \"Primi passi\" nella barra laterale mostra la percentuale e apre la checklist al click", async ({
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

  // Prima dello sblocco della cifratura, l'indicatore non c'è ancora.
  const statusButton = page.getByRole("button", { name: /Primi passi con Hinthial/ });
  await expect(statusButton).not.toBeVisible();

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

  // Account e cifratura fatti, nient'altro ancora: 2 su 5 obbligatori -> 40%.
  await expect(statusButton).toBeVisible({ timeout: 10_000 });
  await expect(statusButton).toHaveAttribute(
    "aria-label",
    "Primi passi con Hinthial: 40% completato",
  );

  await statusButton.click();
  const panel = page.getByRole("dialog", { name: "Primi passi con Hinthial" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Primi passi con Hinthial")).toBeVisible();
  await expect(panel.getByText("2/5")).toBeVisible();
  await expect(panel.getByRole("link", { name: "Aggiungi il primo contenuto all'archivio" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Aggiungi un amico" })).toBeVisible();

  // Un click fuori dal pannello lo chiude.
  // Un click nell'area principale (fuori dal bottone e dal pannello) lo chiude.
  await page.getByRole("heading", { name: "Archivio" }).click();
  await expect(panel).not.toBeVisible();

  // Un documento con categoria completa due passi obbligatori in un colpo solo.
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

  // Riaprendolo si aggiorna: 4 su 5 -> 80%.
  await statusButton.click();
  await expect(statusButton).toHaveAttribute(
    "aria-label",
    "Primi passi con Hinthial: 80% completato",
    { timeout: 10_000 },
  );
  await expect(panel.getByText("4/5")).toBeVisible();
  // Un click nell'area principale (fuori dal bottone e dal pannello) lo chiude.
  await page.getByRole("heading", { name: "Archivio" }).click();

  // Un amico completa l'ultimo obbligatorio: 100%.
  await page.getByRole("link", { name: "Contatti", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
  await page.getByLabel("Nome").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi contatto" }).click();
  await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });
  const contactRow = page.locator("li", { hasText: "Maria Rossi" });
  await expect(contactRow).toBeVisible({ timeout: 10_000 });
  await openRowMenu(contactRow);
  await page.getByRole("menuitem", { name: "Segna come amico" }).click();

  await statusButton.click();
  await expect(statusButton).toHaveAttribute(
    "aria-label",
    "Primi passi con Hinthial: 100% completato",
    { timeout: 10_000 },
  );
  await expect(panel.getByText("5/5")).toBeVisible();
});
