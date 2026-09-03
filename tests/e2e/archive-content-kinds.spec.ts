import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

async function loginAndSetUpEncryption(page: import("@playwright/test").Page) {
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
}

test("scrive una nota testuale, la riapre e ne modifica il contenuto in linea", async ({ page }) => {
  test.slow();

  await loginAndSetUpEncryption(page);

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();

  await page.getByRole("radio", { name: "Scrivi una nota" }).click();
  await page.getByLabel("Titolo").fill("Combinazione cassaforte");
  await page.getByLabel("Testo").fill("12-34-56");
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();

  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  const row = page.locator("li", { hasText: "Combinazione cassaforte" });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("📝 Combinazione cassaforte")).toBeVisible();

  // Apre la nota: il testo scritto in precedenza è decifrato e mostrato in linea.
  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "Apri" }).click();
  const bodyField = row.getByLabel("Testo della nota");
  await expect(bodyField).toHaveValue("12-34-56", { timeout: 10_000 });

  // Modifica titolo e testo, salva --- nessun nuovo file, stesso elemento aggiornato.
  await row.getByLabel("Titolo della nota").fill("Combinazione cassaforte (aggiornata)");
  await bodyField.fill("98-76-54");
  await row.getByRole("button", { name: "Salva nota" }).click();

  const updatedRow = page.locator("li", { hasText: "Combinazione cassaforte (aggiornata)" });
  await expect(updatedRow).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("li", { hasText: "Combinazione cassaforte (aggiornata)" })).toHaveCount(1);

  // Riaprendola, il nuovo testo è quello salvato.
  await openRowMenu(updatedRow);
  await page.getByRole("menuitem", { name: "Apri" }).click();
  await expect(updatedRow.getByLabel("Testo della nota")).toHaveValue("98-76-54", { timeout: 10_000 });
});

test("un'immagine caricata ha un player inline, oltre al download", async ({ page }) => {
  test.slow();

  await loginAndSetUpEncryption(page);

  // Un PNG 1x1 minimale valido, come contenuto di prova.
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.locator("#file").setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: onePixelPng,
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });

  const row = page.locator("li", { hasText: "foto.png" });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("🖼️ foto.png")).toBeVisible();

  // Il player è nascosto finché non lo si apre; "Scarica" resta sempre disponibile nel menu, a fianco.
  await expect(row.locator("img")).not.toBeVisible();
  await openRowMenu(row);
  await expect(page.getByRole("menuitem", { name: "Riproduci" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Scarica" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Riproduci" }).click();
  await expect(row.locator("img")).toBeVisible({ timeout: 10_000 });

  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "Nascondi" }).click();
  await expect(row.locator("img")).not.toBeVisible();
});
