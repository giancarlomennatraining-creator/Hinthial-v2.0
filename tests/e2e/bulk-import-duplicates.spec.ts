import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// FASE 25 --- rilevamento duplicati durante l'import massivo: due file
// con lo stesso nome e la stessa dimensione, arrivati nello stesso
// lotto, devono essere segnalati --- ed esclusi con un clic, senza
// impedire l'importazione del resto.

const MASTER_PASSWORD = "una-master-password-solida";

test("due file identici nello stesso lotto vengono segnalati come possibile duplicato, ed escludibili", async ({
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
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_PASSWORD);
  await page.getByLabel("Conferma master password").fill(MASTER_PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  await page.getByRole("link", { name: "Importa più file insieme" }).click();
  await expect(page.getByRole("heading", { name: "Importa più file insieme" })).toBeVisible();

  const sameContent = Buffer.from("stesso contenuto, stesso nome, stessa dimensione");
  await page.getByLabel("Scegli i file da importare").setInputFiles([
    { name: "ricevuta.txt", mimeType: "text/plain", buffer: sameContent },
    { name: "ricevuta.txt", mimeType: "text/plain", buffer: sameContent },
  ]);

  await expect(page.getByText(/possibile duplicato/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Sembra già presente in Hinthial/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Escludi dall'importazione" })).toBeVisible();

  // Le due righe con lo stesso nome sono comunque distinguibili: due
  // corrispondenze esatte del nome file (non della frase di avviso, che
  // lo contiene anche lei come sottostringa).
  await expect(page.getByText("ricevuta.txt", { exact: true })).toHaveCount(2);

  await page.getByRole("button", { name: "Escludi dall'importazione" }).click();
  await expect(page.getByText(/possibile duplicato/)).not.toBeVisible();
  await expect(page.getByText("ricevuta.txt", { exact: true })).toHaveCount(1);
  await expect(page.getByText("1 file pronto")).toBeVisible();

  await page.getByRole("button", { name: "Importa tutto" }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 60_000 });
  await expect(page.getByText("ricevuta.txt")).toBeVisible({ timeout: 15_000 });
});
