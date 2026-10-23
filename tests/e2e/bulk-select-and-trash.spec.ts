import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { acceptConfirm } from "./confirm-dialog";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Selezione multipla in Archivio (poi
// eliminazione in blocco) e il Cestino che ne raccoglie il risultato
// (ripristino di un documento, eliminazione definitiva di un altro).

const MASTER_PASSWORD = "una-master-password-solida";

async function signInAndSetUpVault(page: import("@playwright/test").Page) {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({
    timeout: 45_000,
  });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();
}

test("selezione multipla e poi l'eliminazione in blocco passa dal Cestino", async ({
  page,
}) => {
  test.slow();

  await signInAndSetUpVault(page);

  // Tre contenuti, per avere di che selezionare in blocco.
  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', [
    { name: "documento-uno.txt", mimeType: "text/plain", buffer: Buffer.from("primo documento di prova") },
    { name: "documento-due.txt", mimeType: "text/plain", buffer: Buffer.from("secondo documento di prova") },
    { name: "documento-tre.txt", mimeType: "text/plain", buffer: Buffer.from("terzo documento di prova") },
  ]);
  await expect(page.getByText("documento-tre.txt")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Aggiungi 3 file all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive\/confirm\?ids=/, { timeout: 60_000 });
  await page.getByRole("button", { name: "Ho finito" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("documento-uno.txt")).toBeVisible({ timeout: 15_000 });

  // Seleziona i tre documenti (checkbox a inizio riga, vista elenco di default).
  await page.getByLabel("Seleziona documento-uno.txt").check();
  await page.getByLabel("Seleziona documento-due.txt").check();
  await page.getByLabel("Seleziona documento-tre.txt").check();
  await expect(page.getByText("3 selezionati")).toBeVisible();

  // "Seleziona tutti" compare solo finché non lo sono già tutti; togliendone uno la selezione scende a due.
  await expect(page.getByRole("button", { name: /Seleziona tutti/ })).toHaveCount(0);
  await page.getByLabel("Seleziona documento-tre.txt").uncheck();
  await expect(page.getByText("2 selezionati")).toBeVisible();
  await expect(page.getByRole("button", { name: "Seleziona tutti (3)" })).toBeVisible();

  // Elimina i due selezionati in blocco --- ora sposta nel cestino, non elimina più subito per sempre.
  await page.getByRole("button", { name: "🗑️ Elimina" }).click();
  await acceptConfirm(page);
  await expect(page.getByText("documento-uno.txt")).not.toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("documento-due.txt")).not.toBeVisible();
  await expect(page.getByText("documento-tre.txt")).toBeVisible(); // il terzo non era selezionato, resta

  // Il Cestino li mostra entrambi.
  await page.getByRole("link", { name: "Cestino" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();
  await expect(page.getByText("documento-uno.txt")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("documento-due.txt")).toBeVisible();
  await expect(page.getByText(/giorni rimasti/).first()).toBeVisible();

  // Ripristina il primo --- torna in Archivio.
  await page
    .locator("li", { hasText: "documento-uno.txt" })
    .getByRole("button", { name: "↩️ Ripristina" })
    .click();
  await expect(page.getByText("documento-uno.txt")).not.toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "Contenuti" }).click();
  await expect(page.getByText("documento-uno.txt")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("documento-due.txt")).not.toBeVisible();

  // Elimina per sempre il secondo, direttamente dal Cestino.
  await page.getByRole("link", { name: "Cestino" }).click();
  await expect(page.getByText("documento-due.txt")).toBeVisible({ timeout: 15_000 });
  await page
    .locator("li", { hasText: "documento-due.txt" })
    .getByRole("button", { name: "Elimina ora" })
    .click();
  await acceptConfirm(page);
  await expect(page.getByText("documento-due.txt")).not.toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Il cestino è vuoto.")).toBeVisible();
});
