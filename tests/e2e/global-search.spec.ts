import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("la ricerca globale trova un asset per nome e ci porta alla sua pagina", async ({ page }) => {
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

  await page.getByRole("link", { name: "Asset" }).click();
  await page.getByRole("link", { name: "+ Crea asset" }).click();
  await page.getByLabel("Nome").fill("Auto Panda");
  await page.getByRole("button", { name: "Aggiungi asset" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  // Prima dell'apertura, il dialog non esiste.
  await expect(page.getByRole("dialog", { name: "Ricerca globale" })).not.toBeVisible();

  await page.getByRole("button", { name: /Cerca/ }).click();
  const dialog = page.getByRole("dialog", { name: "Ricerca globale" });
  await expect(dialog).toBeVisible();

  const input = page.getByPlaceholder("Cerca nell'archivio, asset, scadenze, contatti, capsule…");
  await expect(input).toBeFocused();
  await input.fill("panda");

  await expect(dialog.getByText("Asset", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Auto Panda" }).click();

  await expect(page).toHaveURL(/\/assets$/);
  await expect(dialog).not.toBeVisible();

  // La scorciatoia da tastiera apre/chiude da qualunque pagina.
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();

  // Nessuna corrispondenza: messaggio esplicito, non una lista vuota muta.
  await page.getByRole("button", { name: /Cerca/ }).click();
  await page.getByPlaceholder("Cerca nell'archivio, asset, scadenze, contatti, capsule…").fill("xyzxyz");
  await expect(page.getByText('Nessun risultato per "xyzxyz".')).toBeVisible();
});
