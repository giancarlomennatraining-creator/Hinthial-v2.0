import { expect, test } from "./fixtures";
import { createConfirmedTestUser, setStorageQuota, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) and the migration 20261017000001_storage_quota.sql.
//
// Lo spazio per utente: con un tetto a zero (un'eccezione solo per questo utente), caricare un file deve fermarsi con
// un messaggio che dice cosa fare, non con un errore di permessi; e le Impostazioni devono mostrarlo.

test("a spazio finito un caricamento si ferma con un messaggio chiaro, e le Impostazioni lo dicono", async ({ page }) => {
  test.slow();
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);
  await setStorageQuota(user.email, 0);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "non-ci-sta.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("qualche byte di troppo"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await expect(page.getByText(/Hai finito lo spazio a disposizione \(0 B\)\. Per fare posto svuota il Cestino/)).toBeVisible({
    timeout: 20_000,
  });

  await page.goto("/settings");
  await page.getByRole("tab", { name: "I miei dati" }).click();
  const meter = page.getByRole("progressbar", { name: "Spazio usato" });
  await expect(meter).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("0 B di 0 B")).toBeVisible();
  await expect(page.getByText(/Hai finito lo spazio: non puoi caricare altri file/)).toBeVisible();
});
