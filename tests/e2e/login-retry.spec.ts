import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Dopo un login fallito React svuota i campi del form: l'email deve restare (si riscrive solo la password), e un
// secondo invio con la password giusta deve arrivare alla dashboard, senza ricaricare la pagina.

test("dopo una password sbagliata l'email resta nel campo e basta riscrivere la password", async ({ page }) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("password-sbagliata");
  await page.getByRole("button", { name: "Accedi" }).click();

  await expect(page.getByText("Email o password non corretti.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(user.email);
  await expect(page.getByLabel("Password")).toHaveValue("");

  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
});
