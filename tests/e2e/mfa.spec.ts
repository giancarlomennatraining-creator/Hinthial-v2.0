import { TOTP } from "otpauth";
import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
// Requires TOTP MFA enabled on the Supabase project (Authentication >
// Multi-Factor Authentication in the dashboard) --- disabled by default
// on some projects.

function codeFor(secret: string): string {
  return new TOTP({ secret }).generate();
}

test("attivare l'autenticazione a due fattori richiede il codice al login successivo, e rimuoverla lo toglie di nuovo", async ({
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

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Sicurezza" }).click();
  await expect(page.getByText("⚠️ Non attiva")).toBeVisible();

  // Attivazione: nome del dispositivo, QR, codice a mano da inserire
  // per confermare. toBeVisible() da solo non basta per il QR: un
  // <img> con src rotto risulta comunque "visibile" nel DOM --- si
  // verifica che l'immagine si sia davvero caricata (naturalWidth > 0).
  await page.getByLabel("Nome del dispositivo").fill("Telefono di test");
  await page.getByRole("button", { name: "Attiva l'autenticazione a due fattori" }).click();
  const qrImage = page.getByAltText("QR per l'app authenticator");
  await expect(qrImage).toBeVisible({ timeout: 15_000 });
  await expect(async () => {
    const naturalWidth = await qrImage.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
  const secret = await page.locator("code").innerText();
  expect(secret.length).toBeGreaterThan(10);

  await page.getByLabel("Codice a 6 cifre").fill(codeFor(secret));
  await page.getByRole("button", { name: "Conferma" }).click();

  await expect(page.getByText("Telefono di test")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("⚠️ Non attiva")).not.toBeVisible();
  await expect(
    page.getByText("Ti consigliamo di registrare più di un dispositivo"),
  ).toBeVisible();

  // Un logout/login successivo chiede ora il secondo fattore, non porta
  // dritto alla dashboard.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/login\/mfa$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Verifica in due passaggi" })).toBeVisible();

  // Un codice sbagliato non fa passare.
  await page.getByLabel("Codice a 6 cifre o di backup").fill("000000");
  await page.getByRole("button", { name: "Verifica" }).click();
  await expect(page.getByText("Codice non valido. Riprova.")).toBeVisible();
  await expect(page).toHaveURL(/\/login\/mfa$/);

  // Il codice corretto (rigenerato: qualche secondo è passato) completa il login.
  await page.getByLabel("Codice a 6 cifre o di backup").fill(codeFor(secret));
  await page.getByRole("button", { name: "Verifica" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // Raggiungere direttamente una pagina protetta senza il secondo
  // fattore reindirizza allo stesso passaggio (v. (app)/layout.tsx) ---
  // verificato qui rimuovendo il dispositivo e ripetendo tutto da capo
  // sarebbe ridondante: la copertura del gate diretto vive a parte.

  // Rimuovere il dispositivo disattiva di nuovo l'MFA.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Sicurezza" }).click();
  await expect(page.getByText("Telefono di test")).toBeVisible();
  await page.getByRole("button", { name: "Rimuovi" }).click();
  await expect(page.getByText("⚠️ Non attiva")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
});
