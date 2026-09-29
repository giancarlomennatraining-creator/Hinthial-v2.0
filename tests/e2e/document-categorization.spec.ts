import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("un nome file con parole chiave riconoscibili riceve una categoria suggerita automaticamente", async ({
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

  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  // Il passo 1 non parte più su una modalità già scelta (v. feedback utente): va scelta esplicitamente.
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  // Attende che categorie/beni siano caricati (v. CreateArchiveItemForm,
  // refresh()) prima di caricare un file --- il suggerimento della
  // categoria ha bisogno che l'elenco categorie sia già arrivato.
  const fileInput = page.locator("#file");
  await expect(fileInput).toBeVisible({ timeout: 10_000 });

  // Nessuna categoria scelta a mano: il nome del file basta.
  await fileInput.setInputFiles({
    name: "polizza-assicurazione-auto.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contenuto di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });

  const row = page.locator("li", { hasText: "polizza-assicurazione-auto.txt" });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("🛡️ Assicurazioni")).toBeVisible();

  // Resta comunque solo un suggerimento: correggibile come una scelta
  // normale, dalla scheda del contenuto (sempre modificabile lì).
  await row.getByRole("link", { name: /polizza-assicurazione-auto\.txt/ }).click();
  await expect(page).toHaveURL(/\/archive\/[^/]+$/, { timeout: 15_000 });
  // exact: la tab di default è "Scheda", quindi qui l'unica ambiguità possibile sarebbe stata con la
  // checkbox di esclusione dall'analisi di Hinthia --- ma quella vive nella tab "Analisi con Hinthia"
  // (v. feedback utente), non montata insieme a "Scheda": lasciato comunque per chiarezza.
  await page.getByLabel("Categoria", { exact: true }).selectOption({ label: "🏠 Casa" });
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByText("Modifiche salvate.")).toBeVisible();
  // Niente più un link "Torna all'archivio" qui (era della pagina di modifica ora rimossa): si torna dal nav.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(row.getByText("🏠 Casa")).toBeVisible({ timeout: 10_000 });
});
