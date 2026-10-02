import { expect, test } from "./fixtures";
import {
  createConfirmedTestUser,
  enrollTotpForTestUser,
  generateRecoveryOtp,
  totpCode,
  uniqueTestUser,
} from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// The actual "richiedi il codice" step just calls
// supabase.auth.resetPasswordForEmail(), which sends an email we can't
// read in a test (same inbox-delivery constraint as auth-shell.spec.ts).
// generateRecoveryOtp() produces a real, valid OTP for a test user via
// the admin API instead, so the verifica/nuova-password steps --- the
// actual logic under test --- run against the real Supabase flow.

test("la richiesta di reset reindirizza alla pagina di verifica del codice", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Invia codice" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/forgot-password/verify\\?email=${encodeURIComponent(user.email)}`),
  );
  await expect(page.getByText(user.email)).toBeVisible();
});

test("un codice OTP valido permette di impostare una nuova password e accedere con quella", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  const otp = await generateRecoveryOtp(user.email);

  await page.goto(`/forgot-password/verify?email=${encodeURIComponent(user.email)}`);
  await page.getByLabel("Codice di verifica").fill(otp);
  await page.getByRole("button", { name: "Verifica codice" }).click();

  await expect(page).toHaveURL(/\/forgot-password\/new$/);

  const newPassword = "NuovaPassword123!";
  await page.getByLabel("Nuova password", { exact: true }).fill(newPassword);
  // Il meter di robustezza (gli stessi criteri della registrazione) appare
  // mentre si digita.
  await expect(page.getByText("Almeno 8 caratteri")).toBeVisible();
  await page.getByLabel("Conferma nuova password").fill(newPassword);
  await page.getByRole("button", { name: "Salva nuova password" }).click();

  await expect(page).toHaveURL(/\/login$/);

  // La nuova password funziona per accedere.
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
});

test("un codice OTP non valido mostra un errore", async ({ page }) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto(`/forgot-password/verify?email=${encodeURIComponent(user.email)}`);
  await page.getByLabel("Codice di verifica").fill("000000");
  await page.getByRole("button", { name: "Verifica codice" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/forgot-password\/verify/);
});

test("se la conferma non coincide i campi restano compilati e si corregge senza riscrivere tutto", async ({ page }) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  const otp = await generateRecoveryOtp(user.email);

  await page.goto(`/forgot-password/verify?email=${encodeURIComponent(user.email)}`);
  await page.getByLabel("Codice di verifica").fill(otp);
  await page.getByRole("button", { name: "Verifica codice" }).click();
  await expect(page).toHaveURL(/\/forgot-password\/new$/);

  const newPassword = "NuovaPassword123!";
  await page.getByLabel("Nuova password", { exact: true }).fill(newPassword);
  await page.getByLabel("Conferma nuova password").fill("NuovaPassword999!");
  await page.getByRole("button", { name: "Salva nuova password" }).click();

  await expect(page.getByText("Le password non coincidono.")).toBeVisible();
  // React svuota i campi non controllati dopo l'invio: la conferma deve restare, altrimenti un nuovo clic non parte.
  await expect(page.getByLabel("Nuova password", { exact: true })).toHaveValue(newPassword);
  await expect(page.getByLabel("Conferma nuova password")).toHaveValue("NuovaPassword999!");
  // Senza l'autenticazione a due fattori non si chiede nessun codice.
  await expect(page.getByLabel("Codice a 6 cifre o di backup")).toHaveCount(0);

  await page.getByLabel("Conferma nuova password").fill(newPassword);
  await page.getByRole("button", { name: "Salva nuova password" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("riusare la password attuale dà un messaggio chiaro", async ({ page }) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  const otp = await generateRecoveryOtp(user.email);

  await page.goto(`/forgot-password/verify?email=${encodeURIComponent(user.email)}`);
  await page.getByLabel("Codice di verifica").fill(otp);
  await page.getByRole("button", { name: "Verifica codice" }).click();
  await expect(page).toHaveURL(/\/forgot-password\/new$/);

  await page.getByLabel("Nuova password", { exact: true }).fill(user.password);
  await page.getByLabel("Conferma nuova password").fill(user.password);
  await page.getByRole("button", { name: "Salva nuova password" }).click();

  await expect(page.getByText("La nuova password deve essere diversa da quella attuale.")).toBeVisible();
});

test("con l'autenticazione a due fattori il reset chiede anche il codice dell'app", async ({ page }) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  const secret = await enrollTotpForTestUser(user);
  const otp = await generateRecoveryOtp(user.email);

  await page.goto(`/forgot-password/verify?email=${encodeURIComponent(user.email)}`);
  await page.getByLabel("Codice di verifica").fill(otp);
  await page.getByRole("button", { name: "Verifica codice" }).click();
  await expect(page).toHaveURL(/\/forgot-password\/new$/);

  const newPassword = "NuovaPassword123!";
  await page.getByLabel("Nuova password", { exact: true }).fill(newPassword);
  await page.getByLabel("Conferma nuova password").fill(newPassword);

  // Un codice sbagliato non cambia la password e non svuota i campi.
  await page.getByLabel("Codice a 6 cifre o di backup").fill("000000");
  await page.getByRole("button", { name: "Salva nuova password" }).click();
  await expect(page.getByText("Codice non valido. Riprova.")).toBeVisible();
  await expect(page.getByLabel("Nuova password", { exact: true })).toHaveValue(newPassword);

  await page.getByLabel("Codice a 6 cifre o di backup").fill(totpCode(secret));
  await page.getByRole("button", { name: "Salva nuova password" }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

  // La nuova password è quella vera: il login la accetta e chiede poi il secondo fattore.
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/login\/mfa$/, { timeout: 15_000 });
});
