import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
// Le categorie sono in chiaro (non richiedono la Master Key): a
// differenza di Documenti/Scadenze/Asset, /settings è accessibile subito
// dopo il login, senza passare da RequireMasterKey.

test("gestisce le categorie: elenco iniziale, creazione, modifica, eliminazione", async ({
  page,
}) => {
  // Real PBKDF2 (600,000 iterations, x2) in-browser during il setup
  // cifratura di Documenti può superare il timeout di default.
  test.slow();

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
  await page.getByRole("tab", { name: "Categorie" }).click();
  await expect(page.getByRole("heading", { name: "Categorie" })).toBeVisible();

  // Le 10 categorie iniziali (seminate alla registrazione) sono già lì.
  await expect(page.getByText("👤 Personale")).toBeVisible();
  await expect(page.getByText("🏠 Casa")).toBeVisible();
  await expect(page.getByText("📦 Altro")).toBeVisible();

  // Creazione di una categoria personalizzata.
  await page.getByLabel("Icona").fill("🎯");
  await page.getByLabel("Nome").fill("Hobby");
  await page.getByRole("button", { name: "Aggiungi categoria" }).click();
  await expect(page.getByText("🎯 Hobby")).toBeVisible({ timeout: 10_000 });

  // La nuova categoria è disponibile anche dove si scelgono le categorie.
  await page.getByRole("link", { name: "Documenti" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await page.getByRole("button", { name: "+ Categoria, scadenza, tag, note" }).click();
  await expect(page.locator("#upload-category")).toContainText("🎯 Hobby");

  // Modifica: rinomina la categoria personalizzata.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Categorie" }).click();
  const hobbyRow = page.locator("li", { hasText: "🎯 Hobby" });
  await hobbyRow.getByRole("button", { name: "Modifica" }).click();
  const nameField = page.locator('[id^="edit-"][id$="-name"]');
  await nameField.fill("Hobby e sport");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("🎯 Hobby e sport")).toBeVisible({ timeout: 10_000 });

  // Carica un documento con quella categoria, per testare l'avviso di eliminazione.
  await page.getByRole("link", { name: "Documenti" }).click();
  await page.getByRole("button", { name: "+ Categoria, scadenza, tag, note" }).click();
  await page.locator("#upload-category").selectOption({ label: "🎯 Hobby e sport" });
  await page.setInputFiles('input[type="file"]', {
    name: "tesserino-palestra.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contenuto di prova"),
  });
  await expect(page.getByText("tesserino-palestra.txt")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("🎯 Hobby e sport · ")).toBeVisible();

  // Eliminazione: il popup avverte che è in uso, ma non cancella nulla.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  // Attende che la navigazione sia completa: la riga del documento su
  // Documenti contiene anch'essa il testo della categoria come badge,
  // quindi il locator sotto potrebbe altrimenti trovare quella invece.
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("tab", { name: "Categorie" }).click();
  await expect(page.getByRole("heading", { name: "Categorie" })).toBeVisible();

  let dialogMessage = "";
  page.once("dialog", (dialog) => {
    dialogMessage = dialog.message();
    dialog.accept();
  });
  await page
    .locator("li", { hasText: "🎯 Hobby e sport" })
    .getByRole("button", { name: "Elimina" })
    .click();
  await expect(page.getByText("🎯 Hobby e sport")).not.toBeVisible({ timeout: 10_000 });
  expect(dialogMessage).toContain("1 documento");
  expect(dialogMessage).toContain("NON verranno cancellati");

  // Il documento resta, solo senza più quella categoria.
  await page.getByRole("link", { name: "Documenti" }).click();
  await expect(page.getByText("tesserino-palestra.txt")).toBeVisible();
  await expect(page.getByText("🎯 Hobby e sport · ")).not.toBeVisible();
});

test("il campo Icona propone una lista di icone selezionabili al click", async ({ page }) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Categorie" }).click();
  await expect(page.getByRole("heading", { name: "Categorie" })).toBeVisible();

  const iconField = page.getByLabel("Icona");
  const picker = page.getByRole("listbox", { name: "Icone disponibili" });
  await expect(picker).not.toBeVisible();

  // Cliccando il campo compare la lista di icone selezionabili.
  await iconField.click();
  await expect(picker).toBeVisible();

  await picker.getByRole("option", { name: "🎨" }).click();
  await expect(iconField).toHaveValue("🎨");
  await expect(picker).not.toBeVisible();

  // Cliccare fuori chiude la lista senza modificare il valore scelto.
  await iconField.click();
  await expect(picker).toBeVisible();
  await page.getByLabel("Nome").click();
  await expect(picker).not.toBeVisible();
  await expect(iconField).toHaveValue("🎨");

  await page.getByLabel("Nome").fill("Viaggi");
  await page.getByRole("button", { name: "Aggiungi categoria" }).click();
  await expect(page.getByText("🎨 Viaggi")).toBeVisible({ timeout: 10_000 });
});
