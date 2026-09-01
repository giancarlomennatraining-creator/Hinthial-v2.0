import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

async function loginAndSetUpEncryption(page: import("@playwright/test").Page) {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Documenti", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  // PBKDF2 at 600,000 iterations (x2: setup + immediate unlock) can
  // genuinely take a while in-browser under load --- give it room before
  // the recovery-key screen appears.
  await expect(
    page.getByRole("heading", { name: "Salva la tua recovery key" }),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Documenti" })).toBeVisible();

  return user;
}

test("crea, completa ed elimina scadenze", async ({ page }) => {
  // Real PBKDF2 (600,000 iterations, x2) in-browser during setup can push
  // this past the default 30s test timeout under load.
  test.slow();

  await loginAndSetUpEncryption(page);

  await page.getByRole("link", { name: "Scadenze" }).click();
  await expect(page.getByRole("heading", { name: "Scadenze" })).toBeVisible();
  await expect(page.getByText("Nessuna scadenza ancora")).toBeVisible();

  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  await expect(page.getByRole("heading", { name: "Nuova scadenza" })).toBeVisible();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Titolo").fill("Rinnovo assicurazione auto");
  await page.getByLabel("Data").fill(future);
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();

  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });
  await expect(page.getByText("✅ Scadenza creata.")).toBeVisible();
  await expect(page.getByText("Rinnovo assicurazione auto")).toBeVisible({ timeout: 10_000 });

  // Completa (checkbox) --- il titolo diventa barrato.
  await page.getByRole("checkbox").click();
  await expect(page.getByText("Rinnovo assicurazione auto")).toHaveClass(/line-through/);

  // Elimina.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByText("Nessuna scadenza ancora")).toBeVisible();
});

test("aggiunge scadenza, tag e note a un documento e li vede in dashboard", async ({
  page,
}) => {
  test.slow();

  const user = await loginAndSetUpEncryption(page);

  await page.getByRole("button", { name: "+ Categoria, scadenza, tag, note" }).click();
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.locator("#upload-expires").fill(future);
  await page.locator("#upload-tags").fill("fattura, 2026");
  await page.locator("#upload-notes").fill("Nota di prova");

  await page.setInputFiles('input[type="file"]', {
    name: "documento-con-metadati.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contenuto di prova"),
  });

  await expect(page.getByText("documento-con-metadati.txt")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("fattura")).toBeVisible();
  await expect(page.getByText("2026", { exact: true })).toBeVisible();
  await expect(page.getByText(/scade \d/)).toBeVisible();

  // Modifica: cambia i tag.
  await page.getByRole("button", { name: "Modifica" }).click();
  const tagsField = page.locator('[id^="edit-"][id$="-tags"]');
  await tagsField.fill("aggiornato");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("aggiornato")).toBeVisible({ timeout: 10_000 });

  // La dashboard mostra il documento tra i recenti, e segnala la cifratura configurata.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: `Ciao, ${fullName(user)}` })).toBeVisible();
  await expect(page.getByText("✅ Master password creata · recovery key salvata")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Documenti recenti" })).toBeVisible();
  await expect(page.getByText("documento-con-metadati.txt")).toBeVisible();
});
