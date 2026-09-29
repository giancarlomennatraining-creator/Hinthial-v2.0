import { expect, test, type Page } from "./fixtures";
import * as fs from "node:fs/promises";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

/** La creazione vive in una pagina dedicata (/capsules/new): questo apre quella pagina dall'elenco. */
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

  // Un amico da usare come destinatario.
  await page.getByRole("link", { name: "Amici" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Amici" })).toBeVisible();

  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo amico" })).toBeVisible();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  const friendRow = page.locator("li", { hasText: "Maria Rossi" });
  await expect(friendRow).toBeVisible({ timeout: 10_000 });

  // Un secondo amico, per verificare che una capsula possa avere più destinatari.
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo amico" })).toBeVisible();
  await page.getByLabel("Nome visualizzato").fill("Luca Bianchi");
  await page.getByLabel("Email").fill("luca.bianchi@esempio.it");
  await page.getByLabel("Ruolo").fill("Fratello");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  const secondFriendRow = page.locator("li", { hasText: "Luca Bianchi" });
  await expect(secondFriendRow).toBeVisible({ timeout: 10_000 });

  // Gli amici nascono già ATTIVI: solo i revocati non sono selezionabili come destinatari.
  await expect(friendRow.getByText("Attivo")).toBeVisible({ timeout: 10_000 });
  await expect(secondFriendRow.getByText("Attivo")).toBeVisible({ timeout: 10_000 });

  // Wizard a tre passi: chi/quando, contenuti dall'archivio, audio/video/testo.
  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();
  await expect(page.getByText("Nessuna capsula ancora")).toBeVisible();
  await goToNewCapsule(page);

  const fileContent = `messaggio segreto --- ${Date.now()}`;
  await page.getByLabel("Titolo").fill("Per Maria");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2027-01-01T10:00");
  // Una capsula può essere destinata a più amici: se ne aggiungono due.
  await page.locator("#create-friend").selectOption({ label: "Luca Bianchi" });
  await page.getByRole("button", { name: "+ Aggiungi" }).click();
  await page.locator("#create-friend").selectOption({ label: "Maria Rossi" });
  await page.getByRole("button", { name: "+ Aggiungi" }).click();
  await expect(page.getByText("Maria Rossi")).toBeVisible();
  await expect(page.getByText("Luca Bianchi")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();

  await page.getByLabel("Il tuo messaggio").fill("Un pensiero per te.");
  // Un allegato diretto è ammesso solo se audio/video; gli strumenti restano nascosti finché non si clicca "Aggiungi un allegato".
  await page.getByRole("button", { name: "Aggiungi un allegato" }).click();
  await page.setInputFiles("#mediaFiles", {
    name: "messaggio.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from(fileContent, "utf-8"),
  });
  await expect(page.getByText("🎤 messaggio.mp3")).toBeVisible();
  await page.getByRole("button", { name: "Crea capsula" }).click();

  // Torna all'elenco con un messaggio di conferma sull'esito.
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("Capsula creata.")).toBeVisible();

  const row = page.locator("li", { hasText: "Per Maria" });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("Bozza")).toBeVisible();
  // I destinatari vengono elencati in ordine alfabetico (Luca prima di Maria).
  await expect(row.getByText("Per Luca Bianchi, Maria Rossi · ")).toBeVisible();
  await expect(row.getByText("messaggio.mp3")).toBeVisible();
  // Il testo del messaggio non si vede nella vista a elenco: verificato aprendo l'anteprima.
  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "👁️ Anteprima" }).click();
  const createPreview = page.getByRole("dialog", { name: "Anteprima capsula" });
  await expect(createPreview.getByText("Un pensiero per te.")).toBeVisible();
  await createPreview.getByRole("button", { name: "Chiudi anteprima" }).click();
  await expect(createPreview).not.toBeVisible();

  // Apertura dell'allegato: decritta e scarica il contenuto originale.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    row.getByRole("button", { name: "Apri" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("messaggio.mp3");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const downloadedContent = await fs.readFile(downloadPath!, "utf-8");
  expect(downloadedContent).toBe(fileContent);

  // Finché è in bozza, la capsula è modificabile: anche i destinatari, la data di apertura, l'allegato.
  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "Modifica" }).click();
  await expect(page).toHaveURL(/\/capsules\/[^/]+\/edit$/);
  await expect(page.getByRole("heading", { name: "Modifica capsula" })).toBeVisible();

  await expect(page.getByText("Passo 1 di 3")).toBeVisible();
  await page.getByLabel("Titolo").fill("Per Maria (aggiornato)");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2027-03-15T10:00");
  await page.getByRole("button", { name: "Rimuovi Luca Bianchi" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();

  await expect(page.getByText("Passo 2 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();

  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await page.getByLabel("Il tuo messaggio").fill("Un pensiero aggiornato per te.");
  const removeExistingAttachmentButton = page.getByRole("button", { name: "Rimuovi messaggio.mp3" });
  await expect(removeExistingAttachmentButton).toBeVisible();
  await removeExistingAttachmentButton.click();
  await expect(removeExistingAttachmentButton).not.toBeVisible();
  await page.getByRole("button", { name: "Aggiungi un allegato" }).click();
  const newFileContent = `messaggio aggiornato --- ${Date.now()}`;
  await page.setInputFiles("#mediaFiles", {
    name: "messaggio-nuovo.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from(newFileContent, "utf-8"),
  });
  await expect(page.getByText("🎤 messaggio-nuovo.mp3")).toBeVisible();

  await page.getByRole("button", { name: "Salva modifiche" }).click();

  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("Capsula aggiornata.")).toBeVisible();
  const updatedRow = page.locator("li", { hasText: "Per Maria (aggiornato)" });
  await expect(updatedRow).toBeVisible({ timeout: 10_000 });
  await openRowMenu(updatedRow);
  await page.getByRole("menuitem", { name: "👁️ Anteprima" }).click();
  const updatedPreview = page.getByRole("dialog", { name: "Anteprima capsula" });
  await expect(updatedPreview.getByText("Un pensiero aggiornato per te.")).toBeVisible();
  await updatedPreview.getByRole("button", { name: "Chiudi anteprima" }).click();
  await expect(updatedPreview).not.toBeVisible();
  await expect(updatedRow.getByText("Bozza")).toBeVisible();
  await expect(updatedRow.getByText("Per Maria Rossi · ")).toBeVisible();
  await expect(updatedRow.getByText("apertura prevista 15 mar 2027, 10:00")).toBeVisible();
  // Il countdown non ha senso su una bozza, dato che openAt può ancora cambiare: appare solo dopo la chiusura.
  await expect(updatedRow.getByRole("img", { name: /Si aprirà tra/ })).not.toBeVisible();
  // Il vecchio allegato è sparito, il nuovo è al suo posto.
  await expect(updatedRow.getByText("messaggio.mp3", { exact: true })).not.toBeVisible();
  await expect(updatedRow.getByText("messaggio-nuovo.mp3")).toBeVisible();

  const [newDownload] = await Promise.all([
    page.waitForEvent("download"),
    updatedRow.getByRole("button", { name: "Apri" }).click(),
  ]);
  expect(newDownload.suggestedFilename()).toBe("messaggio-nuovo.mp3");
  const newDownloadPath = await newDownload.path();
  expect(newDownloadPath).not.toBeNull();
  expect(await fs.readFile(newDownloadPath!, "utf-8")).toBe(newFileContent);

  // Stato: Bozza -> Chiusa -> Condivisa. Chiudere è irreversibile, quindi conferma esplicita.
  page.once("dialog", (dialog) => dialog.accept());
  await openRowMenu(updatedRow);
  await page.getByRole("menuitem", { name: "Chiudi la capsula" }).click();
  await expect(updatedRow.getByText("Chiusa", { exact: true })).toBeVisible({ timeout: 10_000 });
  // Ora che non è più una bozza, il countdown compare: oltre i 100 giorni mostra il numero secco invece dei cartellini.
  await expect(updatedRow.getByRole("img", { name: /Si aprirà tra \d+ giorni/ })).toBeVisible();
  // Una volta non più in bozza, non è più modificabile né richiudibile.
  await openRowMenu(updatedRow);
  await expect(page.getByRole("menuitem", { name: "Chiudi la capsula" })).not.toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Modifica" })).not.toBeVisible();

  await page.getByRole("menuitem", { name: "Condividi" }).click();
  await expect(updatedRow.getByText("Condivisa")).toBeVisible({ timeout: 10_000 });
  await openRowMenu(updatedRow);
  await expect(page.getByRole("menuitem", { name: "Condividi" })).not.toBeVisible();

  // In Amici, il destinatario mostra quante capsule lo riguardano, e al passaggio del mouse nome e date.
  await page.getByRole("link", { name: "Amici" }).click();
  await expect(page.getByRole("heading", { name: "Amici" })).toBeVisible();
  const mariaCapsulesBadge = friendRow.getByText("📦 1 capsula");
  await expect(mariaCapsulesBadge).toBeVisible();
  await mariaCapsulesBadge.hover();
  await expect(friendRow.getByText("Per Maria (aggiornato)")).toBeVisible();
  await expect(friendRow.getByText("apertura prevista 15 mar 2027, 10:00")).toBeVisible();
  await expect(secondFriendRow.getByText("📦", { exact: false })).not.toBeVisible();

  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();

  // Eliminazione.
  page.once("dialog", (dialog) => dialog.accept());
  await openRowMenu(updatedRow);
  await page.getByRole("menuitem", { name: "Elimina" }).click();
  await expect(page.getByText("Nessuna capsula ancora")).toBeVisible({ timeout: 10_000 });
});

test("collega un documento già presente in Archivio a una capsula, selezionando categoria e file", async ({
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

  // Un documento già presente in Archivio, con una categoria.
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

  const documentContent = `contratto di prova --- ${Date.now()}`;
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.setInputFiles('input[type="file"]', {
    name: "contratto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(documentContent, "utf-8"),
  });
  await page.getByRole("button", { name: "Aiutaci a ritrovarlo" }).click();
  await page.locator("#upload-category").selectOption({ label: "📄 Contratti" });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("contratto.txt")).toBeVisible({ timeout: 15_000 });

  // Creazione della capsula: allega il documento esistente (categoria -> file -> "+ Allega").
  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();
  await goToNewCapsule(page);

  await page.getByLabel("Titolo").fill("Documenti per dopo");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2027-01-01T10:00");
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 3")).toBeVisible();
  await page.locator("#create-category").selectOption({ label: "📄 Contratti" });
  await page.locator("#create-document").selectOption({ label: "📄 contratto.txt" });
  await page.getByRole("button", { name: "+ Allega" }).click();
  await expect(page.getByText("📄 contratto.txt", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Crea capsula" }).click();

  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("Capsula creata.")).toBeVisible();

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

  // In modifica si può rimuovere il collegamento (il documento in Archivio resta intatto).
  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "Modifica" }).click();
  await expect(page).toHaveURL(/\/capsules\/[^/]+\/edit$/);
  await expect(page.getByText("Passo 1 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Rimuovi contratto.txt" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("Capsula aggiornata.")).toBeVisible();
  await expect(row.getByText("📄 contratto.txt · ")).not.toBeVisible();

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page.locator("li", { hasText: "contratto.txt" })).toBeVisible();
});

test("allega un intero fascicolo a una capsula in un colpo solo", async ({ page }) => {
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
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({
    timeout: 45_000,
  });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  // Un fascicolo con dentro due documenti.
  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await page.getByRole("link", { name: "+ Nuovo fascicolo" }).click();
  await page.getByLabel("Titolo").fill("Trasloco");
  await page.getByRole("button", { name: "Crea fascicolo" }).click();
  await expect(page).toHaveURL(/\/dossiers$/, { timeout: 20_000 });

  for (const name of ["contratto-affitto.txt", "verbale-consegna.txt"]) {
    await page.getByRole("link", { name: "Contenuti", exact: true }).click();
    await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
    await page.setInputFiles('input[type="file"]', {
      name,
      mimeType: "text/plain",
      buffer: Buffer.from(`${name} --- ${Date.now()}`, "utf-8"),
    });
    await page.getByRole("button", { name: "Aiutaci a ritrovarlo" }).click();
    await page.getByLabel("Fascicoli").selectOption({ label: "📂 Trasloco" });
    await page.getByRole("button", { name: "+ Aggiungi fascicolo" }).click();
    await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
    await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
    await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  }

  // In creazione capsula: "Oppure allega un fascicolo intero" prende entrambi.
  await page.getByRole("link", { name: "Capsule" }).click();
  await goToNewCapsule(page);
  await page.getByLabel("Titolo").fill("Documenti del trasloco");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2027-01-01T10:00");
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 3")).toBeVisible();

  await page.getByLabel("Oppure allega un fascicolo intero").selectOption({ label: "📂 Trasloco" });
  await page.getByRole("button", { name: "+ Allega tutto il fascicolo" }).click();
  await expect(page.getByText("📄 contratto-affitto.txt", { exact: true })).toBeVisible();
  await expect(page.getByText("📄 verbale-consegna.txt", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("Capsula creata.")).toBeVisible();

  const row = page.locator("li", { hasText: "Documenti del trasloco" });
  await expect(row.getByText("📄 contratto-affitto.txt · ")).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("📄 verbale-consegna.txt · ")).toBeVisible();
});

test("chiudere una capsula copia il contenuto collegato al suo interno; l'originale in Archivio resta libero e può essere cancellato", async ({
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

  const documentContent = `polizza di prova --- ${Date.now()}`;
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(documentContent, "utf-8"),
  });
  await page.getByRole("button", { name: "Aiutaci a ritrovarlo" }).click();
  await page.locator("#upload-category").selectOption({ label: "📄 Contratti" });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("polizza.txt")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();
  await goToNewCapsule(page);
  await page.getByLabel("Titolo").fill("Capsula da chiudere");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2027-01-01T10:00");
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 3")).toBeVisible();
  await page.locator("#create-category").selectOption({ label: "📄 Contratti" });
  await page.locator("#create-document").selectOption({ label: "📄 polizza.txt" });
  await page.getByRole("button", { name: "+ Allega" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });

  const capsuleRow = page.locator("li", { hasText: "Capsula da chiudere" });
  await expect(capsuleRow).toBeVisible({ timeout: 15_000 });

  // Si chiude la capsula (conferma esplicita, irreversibile): il contenuto collegato viene copiato al suo interno.
  page.once("dialog", (dialog) => dialog.accept());
  await openRowMenu(capsuleRow);
  await page.getByRole("menuitem", { name: "Chiudi la capsula" }).click();
  await expect(capsuleRow.getByText("Chiusa", { exact: true })).toBeVisible({ timeout: 10_000 });
  // La capsula continua a mostrare il contenuto: ora una copia propria.
  await expect(capsuleRow.getByText("polizza.txt")).toBeVisible();

  // L'originale in Archivio non è mai stato bloccato: si può cancellare subito dopo la chiusura.
  // Attende l'intestazione (non solo l'URL, che può aggiornarsi prima che il nuovo contenuto sia montato).
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();
  const docRow = page.locator("li", { hasText: "polizza.txt" });
  await expect(docRow).toBeVisible();
  await openRowMenu(docRow);
  await expect(page.getByRole("menuitem", { name: "Elimina" })).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("menuitem", { name: "Elimina" }).click();
  await expect(page.getByText("Ancora nulla in archivio.")).toBeVisible({ timeout: 10_000 });

  // ...eppure la capsula continua ad aprire il proprio contenuto, identico all'originale ormai cancellato: è una copia autosufficiente.
  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();
  await expect(capsuleRow.getByText("polizza.txt")).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    capsuleRow.getByRole("button", { name: "Apri" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("polizza.txt");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const downloadedContent = await fs.readFile(downloadPath!, "utf-8");
  expect(downloadedContent).toBe(documentContent);
});
