import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

async function loginAndSetUpEncryption(page: import("@playwright/test").Page) {
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
  // PBKDF2 at 600,000 iterations (x2: setup + immediate unlock) can
  // genuinely take a while in-browser under load --- give it room before
  // the recovery-key screen appears.
  await expect(
    page.getByRole("heading", { name: "Salva la tua recovery key" }),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

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
  const reminderRow = page.locator("li", { hasText: "Rinnovo assicurazione auto" });
  page.once("dialog", (dialog) => dialog.accept());
  await openRowMenu(reminderRow);
  await page.getByRole("menuitem", { name: "Elimina" }).click();
  await expect(page.getByText("Nessuna scadenza ancora")).toBeVisible();
});

test("aggiunge scadenza, tag e note a un documento e li vede in dashboard", async ({
  page,
}) => {
  test.slow();

  const user = await loginAndSetUpEncryption(page);

  // La scadenza non si inserisce più in creazione (v. DocumentMetadataFields,
  // showExpiry) --- solo tag e note sono disponibili subito.
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await expect(page.locator("#upload-expires")).toHaveCount(0);
  await page.locator("#upload-tags").fill("fattura, 2026");
  await page.locator("#upload-notes").fill("Nota di prova");

  await page.setInputFiles('input[type="file"]', {
    name: "documento-con-metadati.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contenuto di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();

  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("documento-con-metadati.txt")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("fattura")).toBeVisible();
  await expect(page.getByText("2026", { exact: true })).toBeVisible();

  // Modifica: la scadenza si aggiunge qui, insieme al cambio dei tag.
  const docRow = page.locator("li", { hasText: "documento-con-metadati.txt" });
  await openRowMenu(docRow);
  await page.getByRole("menuitem", { name: "Modifica" }).click();
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const expiresField = page.locator('[id^="edit-"][id$="-expires"]');
  await expiresField.fill(future);
  const tagsField = page.locator('[id^="edit-"][id$="-tags"]');
  await tagsField.fill("aggiornato");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("aggiornato")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/scade \d/)).toBeVisible();

  // La dashboard mostra il documento tra i recenti, e segnala la cifratura configurata.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: `Ciao, ${fullName(user)}` })).toBeVisible();
  await expect(page.getByText("✅ Master password creata · recovery key salvata")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aggiunti di recente" })).toBeVisible();
  await expect(page.getByText("documento-con-metadati.txt")).toBeVisible();
});

test("esporta le scadenze come file .ics per il calendario", async ({ page }) => {
  test.slow();

  await loginAndSetUpEncryption(page);

  await page.getByRole("link", { name: "Scadenze" }).click();
  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Titolo").fill("Rinnovo passaporto");
  await page.getByLabel("Data").fill(future);
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();
  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });
  await expect(page.getByText("Rinnovo passaporto")).toBeVisible({ timeout: 10_000 });

  // Esportazione della singola scadenza.
  const reminderRow = page.locator("li", { hasText: "Rinnovo passaporto" });
  await openRowMenu(reminderRow);
  const [singleDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "Aggiungi al calendario (.ics)" }).click(),
  ]);
  expect(singleDownload.suggestedFilename()).toBe("Rinnovo passaporto.ics");
  const singlePath = await singleDownload.path();
  const singleContent = readFileSync(singlePath!, "utf-8");
  expect(singleContent).toContain("BEGIN:VCALENDAR");
  expect(singleContent).toContain("SUMMARY:Rinnovo passaporto");

  // Esportazione di tutte le scadenze visibili (rispetta i filtri già applicati).
  const [allDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "📅 Esporta calendario (.ics)" }).click(),
  ]);
  expect(allDownload.suggestedFilename()).toBe("hinthial-scadenze.ics");
  const allPath = await allDownload.path();
  const allContent = readFileSync(allPath!, "utf-8");
  expect(allContent).toContain("SUMMARY:Rinnovo passaporto");
});
