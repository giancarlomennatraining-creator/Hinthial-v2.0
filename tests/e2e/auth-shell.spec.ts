import { expect, test, type Page } from "./fixtures";
import {
  createConfirmedTestUser,
  deleteUserByEmail,
  fullName,
  uniqueTestUser,
  type TestUser,
} from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
// Emails created via createConfirmedTestUser are cleaned up afterwards by tests/e2e/global-teardown.ts.
//
// Only "la registrazione crea un account" goes through the real signUp() UI flow, and needs
// E2E_REGISTRATION_TEST_EMAIL configured (skipped otherwise): a dedicated, deliverable test address (not anyone's
// personal one, see .env.local), deleted and recreated on every run. Every other test pre-creates a random user
// via the admin API and exercises the real login form instead.

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
    firstName: "Ada",
    lastName: "Lovelace",
    email: registrationTestEmail!,
    password: "password123",
  };
  await deleteUserByEmail(user.email);

  await page.goto("/register");
  await page.getByLabel("Nome", { exact: true }).fill(user.firstName);
  await page.getByLabel("Cognome").fill(user.lastName);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Conferma password").fill(user.password);
  await page.getByRole("button", { name: "Crea account" }).click();

  // Two valid outcomes depending on whether "Confirm email" is enabled: an immediate session or a redirect to the dedicated "check your email" page.
  await expect(
    page
      .getByRole("heading", { name: `Ciao, ${fullName(user)}` })
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
    page.getByRole("heading", { name: `Ciao, ${fullName(user)}` }),
  ).toBeVisible();

  // Cifratura non ancora configurata: la dashboard lo segnala.
  await expect(page.getByText("Master password non ancora creata")).toBeVisible();

  // La navigazione principale porta alle altre sezioni: per un utente senza cifratura configurata, ognuna mostra
  // il setup della master key. Il flusso vero è coperto altrove; qui basta verificare che la navigazione arrivi.
  await page.getByRole("link", { name: "Hinthia", exact: true }).click();
  await expect(page).toHaveURL(/\/ai$/);
  // La creazione si apre sopra la pagina e non si chiude: ma da lì si può sempre tornare alla dashboard.
  const setup = page.getByRole("dialog", { name: "Crea la master password" });
  await expect(setup.getByRole("heading", { name: "Configura la cifratura" })).toBeVisible();
  await setup.getByRole("link", { name: "Torna alla dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(setup).not.toBeVisible();

  // Il logout invalida la sessione e riporta alla landing.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/);
  // Scoped al banner: la hero della landing ripete "Accedi" in un secondo link (v. home.spec.ts).
  await expect(page.getByRole("banner").getByRole("link", { name: "Accedi" })).toBeVisible();
});

test("login con un account esistente porta alla dashboard", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await loginAndLandOnDashboard(page, user);
  await expect(
    page.getByRole("heading", { name: `Ciao, ${fullName(user)}` }),
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
    page.getByRole("heading", { name: `Ciao, ${fullName(user)}` }),
  ).toBeVisible();
});
