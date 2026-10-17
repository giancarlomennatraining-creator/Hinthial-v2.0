import { expect, test } from "./fixtures";
import { readFileSync } from "node:fs";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";
import { openArchiveTab } from "./nav";

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

  await openArchiveTab(page, "Scadenze");
  await expect(page.getByRole("link", { name: "Scadenze", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Nessuna scadenza ancora")).toBeVisible();

  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  await expect(page.getByRole("heading", { name: "Nuova scadenza" })).toBeVisible();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Titolo").fill("Rinnovo assicurazione auto");
  await page.getByLabel("Data").fill(future);
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();

  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });
  await expect(page.getByText("Scadenza creata.")).toBeVisible();
  await expect(page.getByText("Rinnovo assicurazione auto")).toBeVisible({ timeout: 10_000 });
  // Accanto alla data, quanto manca (la data è fra 30 giorni: 29 o 30 a seconda del fuso).
  await expect(page.getByText(/fra (29|30) giorni/)).toBeVisible();

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

test("aggiunge scadenza e note a un documento e li vede in dashboard", async ({
  page,
}) => {
  test.slow();

  const user = await loginAndSetUpEncryption(page);

  // La scadenza non si inserisce in creazione (v. DocumentMetadataFields, showExpiry): qui si esercita solo
  // le note, la scadenza si aggiunge dalla scheda del contenuto più sotto.
  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  // Il passo 1 non parte più su una modalità già scelta (v. feedback utente): va scelta esplicitamente.
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "documento-con-metadati.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contenuto di prova"),
  });
  await page.getByRole("button", { name: "Dettagli" }).click();
  await page.locator("#upload-notes").fill("Nota di prova");
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();

  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("documento-con-metadati.txt")).toBeVisible({ timeout: 15_000 });

  // Modifica: sempre sulla scheda del contenuto, niente più pagina dedicata --- la scadenza si
  // aggiunge qui.
  const docRow = page.locator("li", { hasText: "documento-con-metadati.txt" });
  await docRow.getByRole("link", { name: /documento-con-metadati\.txt/ }).click();
  await expect(page).toHaveURL(/\/archive\/[^/]+$/, { timeout: 15_000 });
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Scadenza").fill(future);
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByText("Modifiche salvate.")).toBeVisible();
  // Niente più un link "Torna all'archivio" qui (era della pagina di modifica ora rimossa): si torna dal nav.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText(/scade \d/)).toBeVisible();
  await expect(page.getByText(/fra (9|10) giorni/)).toBeVisible();

  // "Oggi" mostra il documento tra le scadenze vicine, e segnala la cifratura configurata.
  await page.getByRole("link", { name: "Oggi" }).click();
  await expect(page.getByRole("heading", { name: `Ciao, ${fullName(user)}` })).toBeVisible();
  await expect(page.getByText("Master password creata · recovery key salvata")).toBeVisible();
  await expect(page.getByRole("region", { name: "Scadenze vicine" }).getByText("documento-con-metadati.txt")).toBeVisible({
    timeout: 15_000,
  });

  // Anche Archivio > Scadenze lo mostra, accanto alle scadenze create come tali (qui nessuna), e porta alla sua scheda.
  await openArchiveTab(page, "Scadenze");
  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });
  const documentExpiries = page.getByRole("region", { name: "Documenti in scadenza" });
  await expect(documentExpiries.getByText("documento-con-metadati.txt")).toBeVisible({ timeout: 15_000 });
  // 9 o 10: la data è scritta in UTC, i giorni si contano nel fuso locale.
  await expect(documentExpiries.getByText(/scade tra (9|10) giorni/)).toBeVisible();
  await expect(page.getByText("Nessuna scadenza creata da te.")).toBeVisible();
  await documentExpiries.getByRole("link", { name: /documento-con-metadati\.txt/ }).click();
  await expect(page).toHaveURL(/\/archive\/[^/]+$/, { timeout: 15_000 });
});

test("esporta le scadenze come file .ics per il calendario", async ({ page }) => {
  test.slow();

  await loginAndSetUpEncryption(page);

  await openArchiveTab(page, "Scadenze");
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
