import { expect, test } from "@playwright/test";
import {
  createConfirmedTestUser,
  generateRecoveryOtp,
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
