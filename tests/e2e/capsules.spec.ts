import { expect, test, type Page } from "@playwright/test";
import * as fs from "node:fs/promises";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * La creazione vive in una pagina dedicata (/capsules/new): questo apre
 * quella pagina dall'elenco. Il chiamante compila il form e sottomette;
 * dopo il salvataggio si torna a /capsules con un messaggio di conferma
 * (verificato qui una volta sola per test, dov'è più leggibile farlo).
 */
async function goToNewCapsule(page: Page) {
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
}

test("crea una capsula con destinatario e allegato, ne segue lo stato, apre l'allegato e la elimina", async ({
  page,
}) => {
  // Real PBKDF2 (600,000 iterations, x2) in-browser during setup can push
  // this past the default 30s test timeout under load.
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // Un contatto fiduciario da usare come destinatario.
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

  await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contatto fiduciario" })).toBeVisible();
  await page.getByLabel("Nome").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi contatto" }).click();
  await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });
  const contactRow = page.locator("li", { hasText: "Maria Rossi" });
  await expect(contactRow).toBeVisible({ timeout: 10_000 });

  // Un secondo contatto, per verificare che una capsula possa avere più destinatari.
  await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contatto fiduciario" })).toBeVisible();
  await page.getByLabel("Nome").fill("Luca Bianchi");
  await page.getByLabel("Email").fill("luca.bianchi@esempio.it");
  await page.getByLabel("Ruolo").fill("Fratello");
  await page.getByRole("button", { name: "Aggiungi contatto" }).click();
  await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });
  const secondContactRow = page.locator("li", { hasText: "Luca Bianchi" });
  await expect(secondContactRow).toBeVisible({ timeout: 10_000 });

  // Solo i contatti ATTIVI sono selezionabili come destinatari di una capsula.
  await contactRow.getByRole("button", { name: "Segna come attivo" }).click();
  await expect(contactRow.getByText("Attivo")).toBeVisible({ timeout: 10_000 });
  await secondContactRow.getByRole("button", { name: "Segna come attivo" }).click();
  await expect(secondContactRow.getByText("Attivo")).toBeVisible({ timeout: 10_000 });

  // Creazione della capsula, nella sua pagina dedicata.
  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();
  await expect(page.getByText("Nessuna capsula ancora")).toBeVisible();
  await goToNewCapsule(page);

  const fileContent = `messaggio segreto --- ${Date.now()}`;
  await page.getByLabel("Titolo").fill("Per Maria");
  // Una capsula può essere destinata a più contatti: se ne aggiungono due.
  await page.locator("#create-contact").selectOption({ label: "Luca Bianchi" });
  await page.getByRole("button", { name: "+ Aggiungi" }).click();
  await page.locator("#create-contact").selectOption({ label: "Maria Rossi" });
  await page.getByRole("button", { name: "+ Aggiungi" }).click();
  await expect(page.getByText("👤 Maria Rossi")).toBeVisible();
  await expect(page.getByText("👤 Luca Bianchi")).toBeVisible();
  await page.getByLabel("Contenuto").fill("Un pensiero per te.");
  await page.setInputFiles('input[type="file"]', {
    name: "lettera.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(fileContent, "utf-8"),
  });
  await page.getByRole("button", { name: "Crea capsula" }).click();

  // Torna all'elenco con un messaggio di conferma sull'esito.
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("✅ Capsula creata.")).toBeVisible();

  const row = page.locator("li", { hasText: "Per Maria" });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("Bozza")).toBeVisible();
  // I destinatari vengono elencati in ordine alfabetico (Luca prima di Maria).
  await expect(row.getByText("Per Luca Bianchi, Maria Rossi · ")).toBeVisible();
  await expect(row.getByText("Un pensiero per te.")).toBeVisible();
  await expect(row.getByText("lettera.txt")).toBeVisible();

  // Apertura dell'allegato: decritta e scarica il contenuto originale.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    row.getByRole("button", { name: "Apri" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("lettera.txt");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const downloadedContent = await fs.readFile(downloadPath!, "utf-8");
  expect(downloadedContent).toBe(fileContent);

  // Finché è in bozza, la capsula è modificabile --- anche i destinatari:
  // se ne rimuove uno, restando comunque con più di zero destinatari.
  // Si imposta anche una data di apertura facoltativa.
  await row.getByRole("button", { name: "Modifica" }).click();
  const editTitleField = page.locator('[id^="edit-"][id$="-title"]');
  const editContentField = page.locator('[id^="edit-"][id$="-content"]');
  const editOpenAtField = page.locator('[id^="edit-"][id$="-openAt"]');
  await editTitleField.fill("Per Maria (aggiornato)");
  await editContentField.fill("Un pensiero aggiornato per te.");
  await editOpenAtField.fill("2027-03-15");
  await page.getByRole("button", { name: "Rimuovi Luca Bianchi" }).click();
  await page.getByRole("button", { name: "Salva" }).click();

  const updatedRow = page.locator("li", { hasText: "Per Maria (aggiornato)" });
  await expect(updatedRow).toBeVisible({ timeout: 10_000 });
  await expect(updatedRow.getByText("Un pensiero aggiornato per te.")).toBeVisible();
  await expect(updatedRow.getByText("Bozza")).toBeVisible();
  await expect(updatedRow.getByText("Per Maria Rossi · ")).toBeVisible();
  await expect(updatedRow.getByText("apertura prevista 15 mar 2027")).toBeVisible();
  // L'allegato non viene toccato dalla modifica.
  await expect(updatedRow.getByText("lettera.txt")).toBeVisible();

  // Stato: Bozza -> Chiusa -> Condivisa. Chiudere è irreversibile, quindi
  // conferma esplicita.
  page.once("dialog", (dialog) => dialog.accept());
  await updatedRow.getByRole("button", { name: "Chiudi la capsula" }).click();
  await expect(updatedRow.getByText("Chiusa", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(updatedRow.getByRole("button", { name: "Chiudi la capsula" })).not.toBeVisible();
  // Una volta non più in bozza, non è più modificabile.
  await expect(updatedRow.getByRole("button", { name: "Modifica" })).not.toBeVisible();

  await updatedRow.getByRole("button", { name: "Condividi" }).click();
  await expect(updatedRow.getByText("Condivisa")).toBeVisible({ timeout: 10_000 });
  await expect(updatedRow.getByRole("button", { name: "Condividi" })).not.toBeVisible();

  // In Contatti fiduciari, il destinatario mostra quante capsule lo
  // riguardano --- e al passaggio del mouse il nome e le date.
  await page.getByRole("link", { name: "Contatti" }).click();
  await expect(page.getByRole("heading", { name: "Contatti fiduciari" })).toBeVisible();
  const mariaCapsulesBadge = contactRow.getByText("📦 1 capsula");
  await expect(mariaCapsulesBadge).toBeVisible();
  await mariaCapsulesBadge.hover();
  await expect(contactRow.getByText("Per Maria (aggiornato)")).toBeVisible();
  await expect(contactRow.getByText("apertura prevista 15 mar 2027")).toBeVisible();
  await expect(secondContactRow.getByText("📦", { exact: false })).not.toBeVisible();

  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();

  // Eliminazione.
  page.once("dialog", (dialog) => dialog.accept());
  await updatedRow.getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByText("Nessuna capsula ancora")).toBeVisible({ timeout: 10_000 });
});

test("collega un documento già presente in Documenti a una capsula, selezionando categoria e file", async ({
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

  // Un documento già presente in Documenti, con una categoria.
  await page.getByRole("link", { name: "Documenti", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Documenti" })).toBeVisible();

  const documentContent = `contratto di prova --- ${Date.now()}`;
  await page.getByRole("button", { name: "+ Categoria, scadenza, tag, note" }).click();
  await page.locator("#upload-category").selectOption({ label: "📄 Contratti" });
  await page.setInputFiles('input[type="file"]', {
    name: "contratto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(documentContent, "utf-8"),
  });
  await expect(page.getByText("contratto.txt")).toBeVisible({ timeout: 15_000 });

  // Creazione della capsula: allega il documento esistente (categoria -> file -> "+ Allega").
  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();
  await goToNewCapsule(page);

  await page.getByLabel("Titolo").fill("Documenti per dopo");
  await page.locator("#create-category").selectOption({ label: "📄 Contratti" });
  await page.locator("#create-document").selectOption({ label: "contratto.txt" });
  await page.getByRole("button", { name: "+ Allega" }).click();
  await expect(page.getByText("📄 contratto.txt", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Crea capsula" }).click();

  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("✅ Capsula creata.")).toBeVisible();

  const row = page.locator("li", { hasText: "Documenti per dopo" });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("📄 contratto.txt · ")).toBeVisible();

  // Apertura del documento collegato: stesso contenuto del documento originale.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    row.getByRole("button", { name: "Apri" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("contratto.txt");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const downloadedContent = await fs.readFile(downloadPath!, "utf-8");
  expect(downloadedContent).toBe(documentContent);

  // In modifica si può rimuovere il collegamento (il documento in Documenti resta intatto).
  await row.getByRole("button", { name: "Modifica" }).click();
  await page.getByRole("button", { name: "Rimuovi contratto.txt" }).click();
  await page.getByRole("button", { name: "Salva" }).click();
  // Attende il rientro effettivo in sola lettura (non solo che il testo
  // sparisca temporaneamente durante il salvataggio) prima di verificare.
  await expect(row.getByRole("button", { name: "Modifica" })).toBeVisible({ timeout: 10_000 });
  await expect(row.getByText("📄 contratto.txt · ")).not.toBeVisible();

  await page.getByRole("link", { name: "Documenti", exact: true }).click();
  await expect(page.locator("li", { hasText: "contratto.txt" })).toBeVisible();
});

test("chiudere una capsula blocca la cancellazione dei documenti collegati; eliminarla la sblocca", async ({
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

  await page.getByRole("link", { name: "Documenti", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Documenti" })).toBeVisible();

  await page.getByRole("button", { name: "+ Categoria, scadenza, tag, note" }).click();
  await page.locator("#upload-category").selectOption({ label: "📄 Contratti" });
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("polizza di prova", "utf-8"),
  });
  await expect(page.getByText("polizza.txt")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();
  await goToNewCapsule(page);
  await page.getByLabel("Titolo").fill("Capsula da chiudere");
  await page.locator("#create-category").selectOption({ label: "📄 Contratti" });
  await page.locator("#create-document").selectOption({ label: "polizza.txt" });
  await page.getByRole("button", { name: "+ Allega" }).click();
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });

  const capsuleRow = page.locator("li", { hasText: "Capsula da chiudere" });
  await expect(capsuleRow).toBeVisible({ timeout: 15_000 });

  // Prima della chiusura, il documento collegato è ancora cancellabile normalmente.
  // Attende l'intestazione della pagina di destinazione --- non solo
  // l'URL/il link attivo nel nav, che possono aggiornarsi prima che il
  // nuovo contenuto sia effettivamente montato --- prima di cercare righe
  // il cui testo potrebbe temporaneamente esistere anche nella pagina
  // precedente (il collegamento al documento dentro la capsula stessa).
  await page.getByRole("link", { name: "Documenti", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Documenti" })).toBeVisible();
  const docRow = page.locator("li", { hasText: "polizza.txt" });
  await expect(docRow).toBeVisible();
  await expect(docRow.getByRole("button", { name: "Elimina" })).toBeEnabled();

  // Si chiude la capsula (conferma esplicita, irreversibile).
  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await capsuleRow.getByRole("button", { name: "Chiudi la capsula" }).click();
  await expect(capsuleRow.getByText("Chiusa", { exact: true })).toBeVisible({ timeout: 10_000 });

  // Ora il documento collegato non è più cancellabile.
  await page.getByRole("link", { name: "Documenti", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Documenti" })).toBeVisible();
  await expect(docRow.getByText("🔒 In una capsula chiusa")).toBeVisible();
  await expect(docRow.getByRole("button", { name: "Elimina" })).toBeDisabled();

  // Si elimina la capsula: il blocco decade.
  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await capsuleRow.getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByText("Nessuna capsula ancora")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Documenti", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Documenti" })).toBeVisible();
  await expect(docRow.getByText("🔒 In una capsula chiusa")).not.toBeVisible();
  await expect(docRow.getByRole("button", { name: "Elimina" })).toBeEnabled();
});
