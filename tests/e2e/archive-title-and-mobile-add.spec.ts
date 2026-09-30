import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Titolo in inserimento e modifica, tasto "+" su smartphone con le stesse scelte del desktop, campi impilati
// nella schermata di inserimento, e Fascicoli/Cestino senza testo descrittivo (c'è l'helper).

const MASTER_PASSWORD = "una-master-password-solida";

async function openArchive(page: import("@playwright/test").Page) {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page
    .getByLabel("Master password", { exact: true })
    .fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({
    timeout: 45_000,
  });
  await page
    .getByLabel("Ho salvato la recovery key in un posto sicuro.")
    .check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();
}

test("Fascicoli e Cestino non hanno più il testo descrittivo sotto i tab", async ({
  page,
}) => {
  test.slow();
  await openArchive(page);

  await page.getByRole("link", { name: "Fascicolo", exact: true }).click();
  await expect(page).toHaveURL(/\/dossiers$/);
  await expect(
    page.getByText("Vicende che attraversano più categorie"),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Cestino", exact: true }).click();
  await expect(page).toHaveURL(/\/trash$/);
  await expect(page.getByText("Un documento eliminato resta qui")).toHaveCount(
    0,
  );
});

test("il titolo si sceglie in inserimento (anche prima del file) e si modifica nella Scheda", async ({
  page,
}) => {
  test.slow();
  await openArchive(page);

  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await page.getByRole("radio", { name: /Carica un file/ }).click();

  // Il titolo c'è già prima di scegliere il file.
  const titolo = page.getByLabel("Titolo");
  await expect(titolo).toBeVisible();
  await titolo.fill("Contratto luce");
  await page.setInputFiles('input[type="file"]', {
    name: "scan_0012.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Contratto fornitura energia"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(
    page.getByRole("heading", { name: "Contratto luce" }),
  ).toBeVisible({ timeout: 30_000 });

  // Fisarmonica fluida: dopo il salvataggio i primi tre passi restano visibili ma bloccati, si apre "Lettura dal
  // dispositivo" e "Analisi di Hinthia" è il passo successivo.
  await expect(
    page.getByRole("button", { name: /Cosa vuoi aggiungere\?/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Lettura dal dispositivo/ }),
  ).toHaveAttribute("aria-expanded", "true");
  // Il passo 2 si ripiega (e poi smonta) in circa mezzo secondo: resta un solo "Continua →", quello del passo 4.
  await expect(page.getByRole("button", { name: "Continua →" })).toHaveCount(1);
  await page.getByRole("button", { name: "Continua →" }).click();
  await expect(
    page.getByRole("button", { name: /Analisi di Hinthia/ }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: /Lettura dal dispositivo/ }),
  ).toHaveAttribute("aria-expanded", "false");

  await page
    .getByRole("link", { name: "Torna all'archivio", exact: true })
    .click();
  await page.getByRole("link", { name: /Contratto luce/ }).click();
  await expect(page).toHaveURL(/\/archive\/[0-9a-f-]+$/, { timeout: 15_000 });

  const schedaTitolo = page.getByLabel("Titolo");
  await expect(schedaTitolo).toHaveValue("Contratto luce");
  await schedaTitolo.fill("Contratto gas");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(
    page.getByRole("button", { name: "Salva modifiche" }),
  ).toBeDisabled({ timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: "Contratto gas" }),
  ).toBeVisible();

  await page.reload();
  await page
    .getByLabel("Master password", { exact: true })
    .fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByLabel("Titolo")).toHaveValue("Contratto gas", {
    timeout: 30_000,
  });
});

test("su smartphone il + dell'Archivio apre le stesse scelte del desktop e i campi di inserimento stanno impilati", async ({
  page,
}) => {
  test.slow();
  await openArchive(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page
    .getByRole("button", { name: "Aggiungi contenuto", exact: true })
    .click();
  const menu = page.getByRole("menu", { name: "Aggiungi contenuto" });
  await expect(
    menu.getByRole("menuitem", { name: "Carica un file" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: "Registra audio/video" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: "Scrivi una nota" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: "Importa più file insieme" }),
  ).toBeVisible();

  await menu.getByRole("menuitem", { name: "Scrivi una nota" }).click();
  await expect(page).toHaveURL(/\/archive\/new\?mode=note$/);

  const titolo = page.getByLabel("Titolo");
  const testo = page.getByLabel("Testo", { exact: true });
  await expect(titolo).toBeVisible();
  const [t, b] = await Promise.all([titolo.boundingBox(), testo.boundingBox()]);
  if (!t || !b) throw new Error("Campi non misurabili.");
  expect(b.y).toBeGreaterThan(t.y + t.height - 1);
  expect(Math.abs(b.x - t.x)).toBeLessThan(2);
  expect(Math.abs(b.width - t.width)).toBeLessThan(2);
});
