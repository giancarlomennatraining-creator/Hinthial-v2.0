import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("configura la cifratura, carica, apre e cancella un documento", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Documenti" }).click();
  await expect(page).toHaveURL(/\/documenti$/);

  // --- Setup della master key (primo accesso) ---
  await expect(page.getByRole("heading", { name: "Configura la cifratura" })).toBeVisible();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();

  await expect(page.getByRole("heading", { name: "Salva la tua recovery key" })).toBeVisible();
  const recoveryKey = await page.locator("code").innerText();
  expect(recoveryKey).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){15}$/);
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
  const fs = await import("node:fs/promises");
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
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Documenti" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("un-altra-master-password");
  await page.getByLabel("Conferma master password").fill("un-altra-master-password");
  await page.getByRole("button", { name: "Crea" }).click();
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
