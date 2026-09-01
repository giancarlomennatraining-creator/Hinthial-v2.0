import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
// Nessuna delle due sezioni richiede la Master Key: nome/cognome ed
// email sono gestiti dall'account Supabase, non dal layer cifrato.

test("Impostazioni è organizzata a schede: Informazioni utente e Categorie", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  // Atterra sulla scheda "Informazioni utente" per default.
  const userInfoTab = page.getByRole("tab", { name: "Informazioni utente" });
  const categoriesTab = page.getByRole("tab", { name: "Categorie" });
  await expect(userInfoTab).toHaveAttribute("aria-selected", "true");
  await expect(categoriesTab).toHaveAttribute("aria-selected", "false");
  await expect(page.getByRole("heading", { name: "Nome e cognome" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Email" })).toBeVisible();
  await expect(page.getByText(user.email)).toBeVisible();

  // Passa a Categorie e torna indietro.
  await categoriesTab.click();
  await expect(categoriesTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Categorie" })).toBeVisible();
  await expect(page.getByText("👤 Personale")).toBeVisible();

  await userInfoTab.click();
  await expect(userInfoTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Nome e cognome" })).toBeVisible();
});

test("modifica nome e cognome: salva e aggiorna il nome mostrato in sidebar", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.locator("#firstName").fill("Grace");
  await page.locator("#lastName").fill("Hopper");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("Salvato.")).toBeVisible({ timeout: 10_000 });

  // Il nome mostrato in sidebar/saluto si aggiorna (router.refresh()).
  await expect(page.getByRole("button", { name: "Grace Hopper" })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Ciao, Grace Hopper" })).toBeVisible();
});

test("cambio email: rifiuta di reinviare la conferma per l'email già attuale", async ({
  page,
}) => {
  // Nota: il percorso "successo" (invio riuscito della mail di conferma)
  // non è testato qui --- come per la registrazione, dipende dal mailer
  // reale (vedi README, limite del sender Resend non verificato) e non è
  // deterministico in CI. Questo test copre la validazione lato client,
  // che non tocca la rete.
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByLabel("Nuova email").fill(user.email);
  await page.getByRole("button", { name: "Cambia email" }).click();

  await expect(page.getByText("È già la tua email attuale.")).toBeVisible();
});
