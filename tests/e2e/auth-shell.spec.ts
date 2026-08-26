import { expect, test } from "@playwright/test";

test("un utente può registrarsi, vedere la dashboard e navigare la shell", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Crea account" }).click();

  await expect(page).toHaveURL(/\/register$/);
  await page.getByLabel("Nome").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Conferma password").fill("password123");
  await page.getByRole("button", { name: "Crea account" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Ciao, Ada Lovelace" })).toBeVisible();

  // La navigazione principale porta alle altre sezioni della shell.
  await page.getByRole("link", { name: "Vault" }).click();
  await expect(page).toHaveURL(/\/vault$/);
  await expect(page.getByRole("heading", { name: "Vault" })).toBeVisible();

  // Il logout invalida la sessione mock e riporta alla landing.
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Accedi" })).toBeVisible();
});

test("le route protette reindirizzano al login se non autenticati", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("login esistente porta alla dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Accedi" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("un refresh a pagina intera su una route protetta resta autenticato", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Un hard reload rilegge la sessione da localStorage passando per una
  // nuova idratazione server->client: non deve rimbalzare su /login.
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Ciao, ada" })).toBeVisible();
});
