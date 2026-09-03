import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("l'anteprima di una capsula mostra titolo, contenuto e allegati come li vedrà chi la riceve", async ({
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

  await page.getByRole("link", { name: "Capsule" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();

  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
  await page.getByLabel("Titolo").fill("Per Maria");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await page.getByLabel("Contenuto").fill("Un pensiero per te, per sempre.");
  const fileContent = `messaggio segreto --- ${Date.now()}`;
  await page.setInputFiles("#mediaFiles", {
    name: "messaggio.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from(fileContent, "utf-8"),
  });
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });

  const row = page.locator("li", { hasText: "Per Maria" });
  await expect(row).toBeVisible({ timeout: 15_000 });

  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "👁️ Anteprima" }).click();

  const dialog = page.getByRole("dialog", { name: "Anteprima capsula" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Così la vedrà chi la riceve")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Per Maria" })).toBeVisible();
  await expect(dialog.getByText("Un pensiero per te, per sempre.")).toBeVisible();
  await expect(dialog.getByText("messaggio.mp3")).toBeVisible();

  // Il player inline funziona anche in anteprima, decifrando l'allegato al volo.
  await dialog.getByRole("button", { name: "Riproduci" }).click();
  await expect(dialog.locator("audio")).toBeVisible({ timeout: 10_000 });

  // Chiudendola, la capsula resta comunque una bozza modificabile --- l'anteprima non ha toccato nulla.
  await dialog.getByRole("button", { name: "Chiudi anteprima" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row.getByText("Bozza")).toBeVisible();
});
