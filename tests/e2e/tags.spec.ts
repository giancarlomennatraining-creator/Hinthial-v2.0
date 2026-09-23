import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Gestione dei tag: aggregazione case-insensitive (con merge), rinomina
// (con merge automatico se il nuovo nome corrisponde a un tag già
// esistente), eliminazione (senza toccare i documenti), e il filtro
// per tag in Archivio.

test("gestisce i tag: aggregazione con merge, rinomina, eliminazione, e il filtro in Archivio", async ({
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
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({
    timeout: 45_000,
  });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  // Primo documento: tag "Casa" e "Lavoro".
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.setInputFiles('input[type="file"]', {
    name: "documento-uno.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("primo documento"),
  });
  await page.getByLabel("Tag (separati da virgola)").fill("Casa, Lavoro");
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("documento-uno.txt")).toBeVisible({ timeout: 15_000 });

  // Secondo documento: tag "casa" (stessa parola, maiuscole diverse) ---
  // deve confluire nello stesso tag del primo, non crearne un secondo.
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "documento-due.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("secondo documento"),
  });
  await page.getByLabel("Tag (separati da virgola)").fill("casa");
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("documento-due.txt")).toBeVisible({ timeout: 15_000 });

  // Terzo documento: nessun tag --- controllo per il filtro più sotto.
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "documento-tre.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("terzo documento"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("documento-tre.txt")).toBeVisible({ timeout: 15_000 });

  // --- Impostazioni --> Tag: "casa"/"Casa" sono un solo tag, con 2 documenti.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Tag" }).click();
  await expect(page.getByRole("heading", { name: "Tag" })).toBeVisible();
  await expect(page.getByText("🏷️ casa")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("2 documenti")).toBeVisible();
  await expect(page.getByText("🏷️ Lavoro")).toBeVisible();
  await expect(page.getByText("1 documento")).toBeVisible();

  // Rinomina "casa" in "Famiglia" --- resta un solo tag con 2 documenti.
  const casaRow = page.locator("li", { hasText: "🏷️ casa" });
  await casaRow.getByRole("button", { name: "Rinomina" }).click();
  await page.getByLabel("Nome").fill("Famiglia");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("🏷️ casa")).not.toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("🏷️ Famiglia")).toBeVisible();
  await expect(page.getByText("2 documenti")).toBeVisible();

  // Eliminazione di "Lavoro" --- il tag sparisce, il documento resta.
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("li", { hasText: "🏷️ Lavoro" }).getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByText("🏷️ Lavoro")).not.toBeVisible({ timeout: 10_000 });

  // --- Archivio: il filtro per tag mostra solo i documenti con "Famiglia".
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page.getByText("documento-uno.txt")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Famiglia", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "🏷️ Famiglia" })).toBeVisible();
  await expect(page.getByText("documento-uno.txt")).toBeVisible();
  await expect(page.getByText("documento-due.txt")).toBeVisible();
  await expect(page.getByText("documento-tre.txt")).not.toBeVisible();

  // Rimuovendo il filtro tornano tutti.
  await page.getByRole("button", { name: "🏷️ Famiglia" }).click();
  await expect(page.getByText("documento-tre.txt")).toBeVisible();
});
