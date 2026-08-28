import { expect, test, type Page } from "@playwright/test";
import {
  createConfirmedTestUser,
  deleteUserByEmail,
  uniqueTestUser,
  type TestUser,
} from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
// Emails created via createConfirmedTestUser are cleaned up afterwards
// by tests/e2e/global-teardown.ts.
//
// Only "la registrazione crea un account" goes through the real signUp()
// UI flow, and needs E2E_REGISTRATION_TEST_EMAIL configured (skipped
// otherwise): an unverified Resend sender can only deliver to the
// Supabase project owner's own address, so this test reuses that one
// fixed address and deletes any pre-existing account for it first, to
// stay repeatable. Every other test just needs "a logged-in user", so it
// pre-creates a random one via the admin API and exercises the real
// *login* form instead.

async function loginAndLandOnDashboard(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

const registrationTestEmail = process.env.E2E_REGISTRATION_TEST_EMAIL;

test("la registrazione crea un account", async ({ page }) => {
  test.skip(
    !registrationTestEmail,
    "E2E_REGISTRATION_TEST_EMAIL non configurata in .env.local",
  );

  const user: TestUser = {
    displayName: "Ada Lovelace",
    email: registrationTestEmail!,
    password: "password123",
  };
  await deleteUserByEmail(user.email);

  await page.goto("/register");
  await page.getByLabel("Nome").fill(user.displayName);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Conferma password").fill(user.password);
  await page.getByRole("button", { name: "Crea account" }).click();

  // Two valid outcomes depending on whether "Confirm email" is enabled
  // on this Supabase project: an immediate session (redirect to the
  // dashboard) or a redirect to the dedicated "check your email" page.
  // The app handles both.
  await expect(
    page
      .getByRole("heading", { name: `Ciao, ${user.displayName}` })
      .or(page.getByRole("heading", { name: "Controlla la tua email" })),
  ).toBeVisible({ timeout: 15_000 });
});

test("le route protette reindirizzano al login se non autenticati", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("un utente autenticato può navigare la shell e fare logout", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await loginAndLandOnDashboard(page, user);
  await expect(
    page.getByRole("heading", { name: `Ciao, ${user.displayName}` }),
  ).toBeVisible();

  // La navigazione principale porta alle altre sezioni della shell.
  // (Non "Documenti"/"Scadenze": per un utente senza cifratura configurata
  // mostrano il setup della master key --- coperto da
  // tests/e2e/documenti.spec.ts e tests/e2e/scadenze.spec.ts.)
  await page.getByRole("link", { name: "Asset" }).click();
  await expect(page).toHaveURL(/\/assets$/);
  await expect(page.getByRole("heading", { name: "Asset" })).toBeVisible();

  // Il logout (nel menu utente, aperto cliccando il nome) invalida la
  // sessione e riporta alla landing.
  await page.getByRole("button", { name: user.displayName }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Accedi" })).toBeVisible();
});

test("login con un account esistente porta alla dashboard", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await loginAndLandOnDashboard(page, user);
  await expect(
    page.getByRole("heading", { name: `Ciao, ${user.displayName}` }),
  ).toBeVisible();
});

test("un refresh a pagina intera su una route protetta resta autenticato", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await loginAndLandOnDashboard(page, user);

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: `Ciao, ${user.displayName}` }),
  ).toBeVisible();
});
