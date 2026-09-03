import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("la checklist dei primi passi mostra il progresso e sparisce a passi obbligatori completati", async ({
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

  // Account e cifratura già fatti (2/4), nessun documento ancora.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText("Primi passi con Hinthial")).toBeVisible();
  await expect(page.getByText("2/4")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Aggiungi il primo contenuto all'archivio" }),
  ).toBeVisible();

  // Un documento con una categoria assegnata completa i due passi rimasti in un colpo solo.
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contenuto" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo contenuto" })).toBeVisible();
  await page.locator("#upload-category").selectOption({ label: "🛡️ Assicurazioni" });
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("polizza di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });
  await expect(page.getByText("polizza.txt")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Aggiunti di recente" })).toBeVisible();
  await expect(page.getByText("Primi passi con Hinthial")).not.toBeVisible();
});

test("i passi opzionali (asset, contatto, capsula, collegamento) si spuntano man mano, ma non contano nel 2/4 obbligatorio", async ({
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

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText("Primi passi con Hinthial")).toBeVisible();
  await expect(page.getByText("2/4")).toBeVisible();
  await expect(page.getByRole("link", { name: "Aggiungi il primo asset" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Aggiungi un contatto fiduciario" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Crea la tua prima capsula" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Collega una capsula a un contatto" })).toBeVisible();

  // Un asset: si spunta solo il suo passo.
  await page.getByRole("link", { name: "Asset", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea asset" }).click();
  await page.getByLabel("Nome").fill("Barca");
  await page.getByRole("button", { name: "Aggiungi asset" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("link", { name: "Aggiungi il primo asset" })).not.toBeVisible();
  await expect(page.getByText("Aggiungi il primo asset")).toBeVisible();
  await expect(page.getByText("2/4")).toBeVisible();

  // Un contatto (attivo, così può poi ricevere una capsula): si spunta il suo passo.
  await page.getByRole("link", { name: "Contatti", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi contatto" }).click();
  await page.getByLabel("Nome").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi contatto" }).click();
  await expect(page).toHaveURL(/\/contacts$/, { timeout: 15_000 });
  const contactRow = page.locator("li", { hasText: "Maria Rossi" });
  await expect(contactRow).toBeVisible({ timeout: 10_000 });
  await openRowMenu(contactRow);
  await page.getByRole("menuitem", { name: "Segna come attivo" }).click();
  await expect(contactRow.getByText("Attivo")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("link", { name: "Aggiungi un contatto fiduciario" })).not.toBeVisible();
  await expect(page.getByText("Aggiungi un contatto fiduciario")).toBeVisible();
  await expect(page.getByText("2/4")).toBeVisible();

  // Una capsula con quel contatto come destinatario: si spuntano insieme
  // "capsula" e "collegamento capsula-contatto".
  await page.getByRole("link", { name: "Capsule", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
  await page.getByLabel("Titolo").fill("Per Maria");
  await page.locator("#create-contact").selectOption({ label: "Maria Rossi" });
  await page.getByRole("button", { name: "+ Aggiungi" }).click();
  await expect(page.getByText("👤 Maria Rossi")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await page.getByLabel("Contenuto").fill("Un pensiero per te.");
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("✅ Capsula creata.")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("link", { name: "Crea la tua prima capsula" })).not.toBeVisible();
  await expect(page.getByText("Crea la tua prima capsula")).toBeVisible();
  await expect(page.getByRole("link", { name: "Collega una capsula a un contatto" })).not.toBeVisible();
  await expect(page.getByText("Collega una capsula a un contatto")).toBeVisible();

  // Tutti e quattro i passi opzionali sono fatti, ma il conteggio e la
  // presenza della checklist restano legati solo ai due obbligatori.
  await expect(page.getByText("2/4")).toBeVisible();
  await expect(page.getByText("Primi passi con Hinthial")).toBeVisible();
});
