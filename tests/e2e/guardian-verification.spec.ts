import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Smoke test solo per la pagina/rotta reale (guardia che la logica
// incrociata tra due account, RLS e la RPC di risposta funzionino
// davvero, senza duplicarlo qui): v. guardian-verification.integration.
// test.ts per quella parte, verificata contro il database reale.

test("un link a una richiesta di verifica inesistente mostra un messaggio chiaro, non un errore", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.goto("/guardian-check/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "Richiesta non trovata" })).toBeVisible();
});
