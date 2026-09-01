import { expect, test } from "@playwright/test";
import * as fs from "node:fs/promises";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("configura la cifratura, carica, apre e cancella un documento", async ({
  page,
}) => {
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

  await page.getByRole("link", { name: "Documenti", exact: true }).click();
  await expect(page).toHaveURL(/\/documents$/);

  // --- Setup della master key (primo accesso) ---
  await expect(page.getByRole("heading", { name: "Configura la cifratura" })).toBeVisible();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();

  // PBKDF2 at 600,000 iterations (x2: setup + immediate unlock) can
  // genuinely take a while in-browser under load --- give it room.
  await expect(
    page.getByRole("heading", { name: "Salva la tua recovery key" }),
  ).toBeVisible({ timeout: 45_000 });
  const recoveryKey = await page.locator("code").innerText();
  expect(recoveryKey).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){191}$/);

  // Il tasto "Copia negli appunti" copia esattamente la recovery key mostrata.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "📋 Copia negli appunti" }).click();
  await expect(page.getByRole("button", { name: "✓ Copiata" })).toBeVisible();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe(recoveryKey);

  // Il tasto "Scarica come .txt" scarica un file di testo con la stessa recovery key.
  const [recoveryKeyDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "⬇️ Scarica come .txt" }).click(),
  ]);
  expect(recoveryKeyDownload.suggestedFilename()).toBe("hinthial-recovery-key.txt");
  const recoveryKeyDownloadPath = await recoveryKeyDownload.path();
  expect(recoveryKeyDownloadPath).not.toBeNull();
  const recoveryKeyFileContent = await fs.readFile(recoveryKeyDownloadPath!, "utf-8");
  expect(recoveryKeyFileContent).toContain(recoveryKey);

  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();

  // --- Pannello Documenti (vuoto) ---
  await expect(page.getByRole("heading", { name: "Documenti" })).toBeVisible();
  await expect(page.getByText("Nessun documento ancora")).toBeVisible();

  // --- Upload ---
  const fileContent = `contenuto di test --- ${Date.now()}`;
  await page.setInputFiles('input[type="file"]', {
    name: "appunti.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(fileContent, "utf-8"),
  });

  await expect(page.getByText("appunti.txt")).toBeVisible({ timeout: 15_000 });

  // --- Apertura/decrittazione (download) ---
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Apri" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("appunti.txt");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const downloadedContent = await fs.readFile(downloadPath!, "utf-8");
  expect(downloadedContent).toBe(fileContent);

  // --- Eliminazione ---
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByText("appunti.txt")).not.toBeVisible();
  await expect(page.getByText("Nessun documento ancora")).toBeVisible();
});

test("un secondo login richiede lo sblocco con la master password", async ({
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

  await page.getByRole("link", { name: "Documenti", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("un-altra-master-password");
  await page.getByLabel("Conferma master password").fill("un-altra-master-password");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByText("Nessun documento ancora")).toBeVisible();

  // Un refresh perde la master key dalla memoria: richiede lo sblocco.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sblocca" })).toBeVisible();

  // Password sbagliata --- errore chiaro, non un crash.
  await page.getByLabel("Master password").fill("password-sbagliata");
  await page.getByRole("button", { name: "Sblocca" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sblocca" })).toBeVisible();

  // Password corretta --- sblocca e torna al pannello Documenti.
  await page.getByLabel("Master password").fill("un-altra-master-password");
  await page.getByRole("button", { name: "Sblocca" }).click();
  await expect(page.getByRole("heading", { name: "Documenti" })).toBeVisible();
});
