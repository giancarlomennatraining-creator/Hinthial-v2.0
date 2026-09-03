import { expect, test, type Page } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * La creazione vive in una pagina dedicata (/assets/new, v. CapsulesPanel
 * per lo stesso pattern): apre quella pagina dall'elenco, compila e
 * sottomette, poi verifica il ritorno a /assets col messaggio di conferma.
 */
async function createAsset(page: Page, name: string, categoryLabel?: string) {
  await page.getByRole("link", { name: "+ Crea asset" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo asset" })).toBeVisible();
  await page.getByLabel("Nome").fill(name);
  if (categoryLabel) await page.locator("#categoryId").selectOption({ label: categoryLabel });
  await page.getByRole("button", { name: "Aggiungi asset" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });
  await expect(page.getByText("✅ Asset creato.")).toBeVisible();
}

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
  // PBKDF2 at 600,000 iterations (x2: setup + immediate unlock) can
  // genuinely take a while in-browser under load --- give it room before
  // the recovery-key screen appears.
  await expect(
    page.getByRole("heading", { name: "Salva la tua recovery key" }),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  return user;
}

test("crea un asset e vi collega un documento e una scadenza", async ({ page }) => {
  // Real PBKDF2 (600,000 iterations, x2) in-browser during setup can push
  // this past the default 30s test timeout under load.
  test.slow();

  await loginAndSetUpEncryption(page);

  await page.getByRole("link", { name: "Asset" }).click();
  await expect(page.getByRole("heading", { name: "Asset" })).toBeVisible();
  await expect(page.getByText("Nessun asset ancora")).toBeVisible();

  await createAsset(page, "Casa di Via Roma", "🏠 Casa");
  await expect(page.getByText("Casa di Via Roma")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Nessuno.")).toBeVisible();
  await expect(page.getByText("Nessuna.")).toBeVisible();

  // Carica un contenuto e collegalo all'asset. Il menu asset è filtrato
  // dalla categoria: va scelta prima, altrimenti resta vuoto/disabilitato.
  await page.getByRole("link", { name: "Archivio" }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  // Senza categoria selezionata, il menu asset è vuoto/disabilitato.
  await expect(page.locator("#upload-asset")).toBeDisabled();
  await expect(page.locator("#upload-asset")).not.toContainText("Casa di Via Roma");

  await page.locator("#upload-category").selectOption({ label: "🏠 Casa" });
  await page.locator("#upload-asset").selectOption({ label: "Casa di Via Roma" });
  await page.setInputFiles('input[type="file"]', {
    name: "contratto-affitto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contenuto di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("contratto-affitto.txt")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("🔗 Casa di Via Roma")).toBeVisible();

  // Crea una scadenza e collegala all'asset.
  await page.getByRole("link", { name: "Scadenze" }).click();
  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  await expect(page.getByRole("heading", { name: "Nuova scadenza" })).toBeVisible();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Titolo").fill("Pagamento IMU");
  await page.getByLabel("Data").fill(future);
  await page.getByLabel("Asset collegato").selectOption({ label: "Casa di Via Roma" });
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();
  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });
  await expect(page.getByText("✅ Scadenza creata.")).toBeVisible();
  await expect(page.getByText("Pagamento IMU")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("🔗 Casa di Via Roma")).toBeVisible();

  // L'asset mostra entrambe le relazioni.
  await page.getByRole("link", { name: "Asset" }).click();
  await expect(page.getByText("📄 contratto-affitto.txt")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/⏰ Pagamento IMU/)).toBeVisible();

  // Eliminare l'asset scollega, non elimina, documento e scadenza.
  const assetRow = page.locator("li", { hasText: "Casa di Via Roma" });
  page.once("dialog", (dialog) => dialog.accept());
  await openRowMenu(assetRow);
  await page.getByRole("menuitem", { name: "Elimina" }).click();
  await expect(page.getByText("Nessun asset ancora")).toBeVisible();

  await page.getByRole("link", { name: "Archivio" }).click();
  await expect(page.getByText("contratto-affitto.txt")).toBeVisible();
  await page.getByRole("link", { name: "Scadenze" }).click();
  await expect(page.getByText("Pagamento IMU")).toBeVisible();
});

test("la categoria filtra gli asset nei documenti, l'asset filtra i documenti nelle scadenze", async ({
  page,
}) => {
  test.slow();

  await loginAndSetUpEncryption(page);

  // Due asset di categorie diverse.
  await page.getByRole("link", { name: "Asset" }).click();
  await createAsset(page, "Appartamento", "🏠 Casa");
  await expect(page.getByText("Appartamento")).toBeVisible({ timeout: 10_000 });

  await createAsset(page, "Fiat Panda", "🚗 Veicoli");
  await expect(page.getByText("Fiat Panda")).toBeVisible({ timeout: 10_000 });

  // Archivio: selezionare la categoria "Casa" filtra il menu asset alla
  // sola "Appartamento" (non mostra "Fiat Panda").
  await page.getByRole("link", { name: "Archivio" }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.locator("#upload-category").selectOption({ label: "🏠 Casa" });
  await expect(page.locator("#upload-asset")).toContainText("Appartamento");
  await expect(page.locator("#upload-asset")).not.toContainText("Fiat Panda");
  await page.locator("#upload-asset").selectOption({ label: "Appartamento" });
  await page.setInputFiles('input[type="file"]', {
    name: "contratto-affitto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contenuto di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("contratto-affitto.txt")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.locator("#upload-category").selectOption({ label: "🚗 Veicoli" });
  await expect(page.locator("#upload-asset")).toContainText("Fiat Panda");
  await expect(page.locator("#upload-asset")).not.toContainText("Appartamento");
  await page.locator("#upload-asset").selectOption({ label: "Fiat Panda" });
  await page.setInputFiles('input[type="file"]', {
    name: "libretto-auto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contenuto di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("libretto-auto.txt")).toBeVisible({ timeout: 15_000 });

  // Scadenze: senza asset selezionato, il menu documento è
  // vuoto/disabilitato --- selezionare l'asset "Appartamento" lo
  // popola con il solo documento già legato a quell'asset.
  await page.getByRole("link", { name: "Scadenze" }).click();
  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  await expect(page.getByRole("heading", { name: "Nuova scadenza" })).toBeVisible();
  await expect(page.locator("#relatedDocumentId")).toBeDisabled();

  await page.getByLabel("Asset collegato").selectOption({ label: "Appartamento" });
  await expect(page.locator("#relatedDocumentId")).toContainText("contratto-affitto.txt");
  await expect(page.locator("#relatedDocumentId")).not.toContainText("libretto-auto.txt");

  // Cambiando asset, il filtro si aggiorna di conseguenza.
  await page.getByLabel("Asset collegato").selectOption({ label: "Fiat Panda" });
  await expect(page.locator("#relatedDocumentId")).toContainText("libretto-auto.txt");
  await expect(page.locator("#relatedDocumentId")).not.toContainText("contratto-affitto.txt");
});
