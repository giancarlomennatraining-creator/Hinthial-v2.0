import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("le intestazioni delle tabelle in Archivio ordinano lessicograficamente, con un secondo click che inverte la direzione", async ({
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

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  for (const name of ["Banana.txt", "Ananas.txt", "Ciliegia.txt"]) {
    await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
    await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
    await page.setInputFiles('input[type="file"]', {
      name,
      mimeType: "text/plain",
      buffer: Buffer.from("contenuto di prova"),
    });
    await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
    await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
  }

  await page.getByRole("radio", { name: "Vista a tabella" }).click();
  await expect(page.locator("table")).toBeVisible();

  const nameCells = page.locator("tbody tr td:first-child");
  const nameHeader = page.getByRole("columnheader", { name: "Nome" });

  // Ordinamento predefinito: prima colonna (Nome), crescente A→Z --- non
  // più l'ordine cronologico. "📄 " davanti al nome è l'icona del tipo di
  // contenuto (v. CONTENT_KIND_ICON).
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(nameCells).toHaveText(["📄 Ananas.txt", "📄 Banana.txt", "📄 Ciliegia.txt"]);

  // Un click sulla stessa colonna già attiva inverte la direzione.
  await nameHeader.getByRole("button", { name: "Nome" }).click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
  await expect(nameCells).toHaveText(["📄 Ciliegia.txt", "📄 Banana.txt", "📄 Ananas.txt"]);

  // Un secondo click torna a crescente.
  await nameHeader.getByRole("button", { name: "Nome" }).click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(nameCells).toHaveText(["📄 Ananas.txt", "📄 Banana.txt", "📄 Ciliegia.txt"]);
});

test("le intestazioni delle tabelle in Contatti fiduciari ordinano lessicograficamente", async ({
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

  await page.getByRole("link", { name: "Contatti" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Contatti fiduciari" })).toBeVisible();

  for (const [name, email] of [
    ["Luca Bianchi", "luca@esempio.it"],
    ["Anna Verdi", "anna@esempio.it"],
  ]) {
    await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
    await expect(page.getByRole("heading", { name: "Nuovo contatto fiduciario" })).toBeVisible();
    await page.getByLabel("Nome").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Ruolo").fill("Amico");
    await page.getByRole("button", { name: "Aggiungi contatto" }).click();
    await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  }

  await page.getByRole("radio", { name: "Vista a tabella" }).click();
  await expect(page.locator("table")).toBeVisible();

  const nameCells = page.locator("tbody tr td:first-child");

  // Già ordinata per Nome crescente di default, senza bisogno di alcun click.
  await expect(nameCells).toHaveText(["Anna Verdi", "Luca Bianchi"]);

  await page.getByRole("columnheader", { name: "Nome" }).getByRole("button", { name: "Nome" }).click();
  await expect(nameCells).toHaveText(["Luca Bianchi", "Anna Verdi"]);
});
