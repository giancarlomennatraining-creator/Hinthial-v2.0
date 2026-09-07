import { TOTP } from "otpauth";
import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

function codeFor(secret: string): string {
  return new TOTP({ secret }).generate();
}

test("i codici di backup coprono la perdita dei dispositivi MFA: generazione, uso singolo, rigenerazione", async ({
  page,
}) => {
  test.slow();
  page.on("console", (msg) => {
    if (msg.text().includes("DEBUG")) console.log("BROWSER:", msg.text());
  });

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Sicurezza" }).click();

  // Senza nessun fattore attivo, i codici di backup non hanno senso: la sezione non compare.
  await expect(page.getByRole("heading", { name: "Codici di backup" })).not.toBeVisible();

  // Prerequisito: almeno un fattore (qui TOTP).
  await page.getByLabel("Nome del dispositivo").fill("Telefono di test");
  await page.getByRole("button", { name: "Attiva l'autenticazione a due fattori" }).click();
  await expect(page.getByAltText("QR per l'app authenticator")).toBeVisible({ timeout: 15_000 });
  const secret = await page.locator("code").innerText();
  await page.getByLabel("Codice a 6 cifre").fill(codeFor(secret));
  await page.getByRole("button", { name: "Conferma" }).click();
  await expect(page.getByText("Telefono di test")).toBeVisible({ timeout: 10_000 });

  // Ora la sezione compare, senza codici ancora generati.
  await expect(page.getByRole("heading", { name: "Codici di backup" })).toBeVisible();
  await expect(page.getByText("Nessun codice di backup generato.")).toBeVisible();

  await page.getByRole("button", { name: "Genera codici di backup" }).click();
  await expect(page.getByText("Salvane una copia adesso")).toBeVisible();
  const codeTexts = await page.locator("code").allInnerTexts();
  // Filtrati per forma (XXXXX-XXXXX) invece che per indice/conteggio: più
  // robusto a qualunque altro <code> presente in pagina in futuro.
  const backupCodes = codeTexts.filter((t) => /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(t));
  expect(backupCodes).toHaveLength(10);

  // "Fatto" resta disabilitato finché non si conferma di averli salvati.
  const doneButton = page.getByRole("button", { name: "Fatto" });
  await expect(doneButton).toBeDisabled();
  await page.getByLabel("Ho salvato questi codici in un posto sicuro.").check();
  await expect(doneButton).toBeEnabled();
  await doneButton.click();

  await expect(page.getByText("10 codici rimasti.")).toBeVisible();

  // Un codice di backup funziona al login al posto del codice dell'app authenticator.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/login\/mfa$/, { timeout: 15_000 });

  const usedCode = backupCodes[0];
  await page.getByLabel("Codice a 6 cifre o di backup").fill(usedCode);
  await page.getByRole("button", { name: "Verifica" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // Il conteggio scende di uno, e lo stesso codice non funziona una seconda volta.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Sicurezza" }).click();
  await expect(page.getByText("9 codici rimasti.")).toBeVisible();

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/login\/mfa$/, { timeout: 15_000 });
  await page.getByLabel("Codice a 6 cifre o di backup").fill(usedCode);
  await page.getByRole("button", { name: "Verifica" }).click();
  await expect(page.getByText("Codice non valido. Riprova.")).toBeVisible();

  // Un codice TOTP valido resta comunque utilizzabile qui.
  await page.getByLabel("Codice a 6 cifre o di backup").fill(codeFor(secret));
  await page.getByRole("button", { name: "Verifica" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // Rigenerare invalida subito tutti i codici precedenti (anche quelli mai usati).
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Sicurezza" }).click();
  await page.getByRole("button", { name: "Rigenera codici di backup" }).click();
  await expect(page.getByText("Salvane una copia adesso")).toBeVisible();
  const newCodeTexts = await page.locator("code").allInnerTexts();
  const newBackupCodes = newCodeTexts.filter((t) => /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(t));
  expect(newBackupCodes).toHaveLength(10);
  expect(newBackupCodes).not.toContain(backupCodes[1]);
  await page.getByLabel("Ho salvato questi codici in un posto sicuro.").check();
  await page.getByRole("button", { name: "Fatto" }).click();

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/login\/mfa$/, { timeout: 15_000 });
  await page.getByLabel("Codice a 6 cifre o di backup").fill(backupCodes[1]);
  await page.getByRole("button", { name: "Verifica" }).click();
  await expect(page.getByText("Codice non valido. Riprova.")).toBeVisible();
});
