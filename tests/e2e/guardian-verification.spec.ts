import { expect, test } from "./fixtures";
import { createConfirmedTestUser, createGuardianCheck, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Smoke test solo per la pagina/rotta reale (guardia che la logica
// incrociata tra due account, RLS e la RPC di risposta funzionino
// davvero, senza duplicarlo qui): v. guardian-verification.integration.
// test.ts per quella parte, verificata contro il database reale.

test("un link a una richiesta di verifica inesistente mostra un messaggio chiaro, non un errore", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.goto("/guardian-check/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "Richiesta non trovata" })).toBeVisible();
});

test("il guardiano trova la richiesta in Oggi, sa cosa provoca ogni risposta e conferma prima di dire che non la raggiunge", async ({
  page,
}) => {
  test.slow();

  // Marta ha scelto il guardiano; la richiesta la crea il cron dopo mesi di silenzio, qui la si crea direttamente.
  const owner = { ...uniqueTestUser(), firstName: "Marta", lastName: "Rossi" };
  const guardian = uniqueTestUser();
  await Promise.all([createConfirmedTestUser(owner), createConfirmedTestUser(guardian)]);
  await createGuardianCheck(owner.email, guardian.email);

  await page.goto("/login");
  await page.getByLabel("Email").fill(guardian.email);
  await page.getByLabel("Password").fill(guardian.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // In Oggi, anche senza master password: chi ha bisogno di te, e il link per rispondere.
  const richieste = page.getByRole("region", { name: "Richieste ai guardiani" });
  await expect(richieste.getByText("Marta Rossi ha bisogno di te")).toBeVisible({ timeout: 15_000 });
  await richieste.getByRole("link", { name: "Rispondi" }).click();

  await expect(page.getByRole("heading", { name: "Hai notizie di Marta?" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Prima di rispondere")).toBeVisible();
  const risposte = page.getByRole("group", { name: "La tua risposta" });
  await expect(risposte.getByRole("button")).toHaveCount(3);
  await expect(risposte.getByRole("button", { name: /Sì, ho notizie di Marta/ })).toContainText("Tutto si ferma subito");

  // "Non riesco a raggiungerla" chiede una conferma, con le conseguenze scritte; si può tornare indietro.
  await risposte.getByRole("button", { name: /Non riesco a raggiungere Marta/ }).click();
  await expect(page.getByRole("heading", { name: "Non riesci a raggiungere Marta?" })).toBeVisible();
  await expect(page.getByText(/le capsule che ha preparato si apriranno/)).toBeVisible();
  await page.getByRole("button", { name: "Torna indietro" }).click();
  await expect(page.getByRole("heading", { name: "Hai notizie di Marta?" })).toBeVisible();

  // "Non lo so ancora": registrata, e si può cambiare.
  await risposte.getByRole("button", { name: /Non lo so ancora/ }).click();
  await expect(page.getByRole("heading", { name: "Grazie" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Se riesci ad avere notizie di Marta, torna qui/)).toBeVisible();

  await page.getByRole("button", { name: "Cambia risposta" }).click();
  await page.getByRole("group", { name: "La tua risposta" }).getByRole("button", { name: /Non riesco a raggiungere Marta/ }).click();
  await page.getByRole("button", { name: "Confermo: non riesco a raggiungere Marta" }).click();
  await expect(page.getByRole("heading", { name: "Grazie" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/hai confermato di non riuscire a raggiungere Marta/)).toBeVisible();

  // Con la risposta data, la richiesta non compare più in Oggi.
  await page.getByRole("link", { name: "Vai a Oggi" }).click();
  await expect(page.getByRole("heading", { name: /^Ciao, / })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Marta Rossi ha bisogno di te")).toHaveCount(0);
});
