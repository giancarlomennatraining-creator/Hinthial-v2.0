import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("trascrizione di un audio in Archivio: il motore automatico non è ancora disponibile, si scrive a mano e si trova con la ricerca", async ({
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
  await page.locator("#file").setInputFiles({
    name: "messaggio.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("finto audio", "utf-8"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });

  const row = page.locator("li", { hasText: "messaggio.mp3" });
  await expect(row).toBeVisible({ timeout: 15_000 });

  // Il motore automatico è solo un segnaposto oggi (v. domain/transcription) --- dichiara onestamente di non essere disponibile.
  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "📝 Trascrizione" }).click();
  await row.getByRole("button", { name: "Trascrivi automaticamente" }).click();
  await expect(row.getByText(/non è ancora disponibile in questa versione/)).toBeVisible();

  // Scritta a mano, poi salvata. Scoped a `row`: l'etichetta della
  // ricerca globale contiene anch'essa la parola "trascrizione".
  await row.getByLabel("Trascrizione").fill("la combinazione della cassaforte è 12-34-56");
  await page.getByRole("button", { name: "Salva trascrizione" }).click();
  await expect(page.getByRole("button", { name: "Salva trascrizione" })).not.toBeVisible({
    timeout: 10_000,
  });

  // Ricercabile: il file si trova per una parola presente solo nella trascrizione, non nel nome.
  const searchInput = page.getByPlaceholder("Cerca per nome, tag, note o trascrizione…");
  await searchInput.fill("cassaforte");
  await expect(row).toBeVisible();
  await searchInput.fill("");

  // Riaprendola, il testo mostrato è quello salvato.
  await openRowMenu(row);
  await page.getByRole("menuitem", { name: "📝 Trascrizione" }).click();
  await expect(row.getByLabel("Trascrizione")).toHaveValue(
    "la combinazione della cassaforte è 12-34-56",
  );
});

test("trascrizione di un allegato audio in una capsula: si scrive a mano e resta collegata all'allegato", async ({
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
  await page.getByLabel("Data di apertura", { exact: true }).fill("2027-01-01");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await page.setInputFiles("#mediaFiles", {
    name: "messaggio.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("finto audio", "utf-8"),
  });
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });

  const row = page.locator("li", { hasText: "Per Maria" });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("messaggio.mp3")).toBeVisible();

  // Il tasto per la trascrizione è per l'allegato, sempre visibile accanto ad "Apri" --- non dentro il menu "⋮" della capsula.
  await row.getByRole("button", { name: "📝 Trascrizione" }).click();
  await row.getByRole("button", { name: "Trascrivi automaticamente" }).click();
  await expect(row.getByText(/non è ancora disponibile in questa versione/)).toBeVisible();

  await row.getByLabel("Trascrizione").fill("ti voglio bene, ricordati di innaffiare le piante");
  await row.getByRole("button", { name: "Salva trascrizione" }).click();
  await expect(row.getByRole("button", { name: "Salva trascrizione" })).not.toBeVisible({
    timeout: 10_000,
  });

  // Riaprendola, il testo mostrato è quello salvato.
  await row.getByRole("button", { name: "📝 Trascrizione" }).click();
  await expect(row.getByLabel("Trascrizione")).toHaveValue(
    "ti voglio bene, ricordati di innaffiare le piante",
  );
});
