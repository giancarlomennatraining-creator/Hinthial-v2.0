import { expect, test } from "./fixtures";
import { createConfirmedTestUser, forceOwnFriendToGuardian, uniqueTestUser } from "./test-users";
import { openArchiveTab } from "./nav";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("\"Oggi\" mostra la continuità, le capsule per chi ami e le scadenze vicine; il punteggio sale quando si fa un passo", async ({
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
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible();

  // Vault ancora vuoto: la continuità è a zero e dice cosa fare, le capsule invitano a scriverne una, nessuna scadenza.
  await page.getByRole("link", { name: "Oggi" }).click();
  await expect(page.getByRole("heading", { name: "Continuità" })).toBeVisible({ timeout: 15_000 });
  const continuity = page.getByRole("region", { name: "Continuità" });
  await expect(continuity.getByText("0 su 4")).toBeVisible({ timeout: 15_000 });
  await expect(continuity.getByText("Nessun guardiano: scegli chi può confermare la tua assenza")).toBeVisible();
  await expect(continuity.getByText("L'eredità digitale è spenta: attivala")).toBeVisible();
  await expect(continuity.getByText("La scheda d'emergenza è vuota: compilala")).toBeVisible();
  await expect(continuity.getByText("Nessuna capsula per chi ami: scrivine una")).toBeVisible();
  await expect(page.getByRole("region", { name: "Per chi ami" }).getByText("Scrivi una capsula →")).toBeVisible();
  await expect(page.getByText("Nessuna scadenza da ricordare.")).toBeVisible();

  // I contatori per sezione e "Da tenere d'occhio" non ci sono più.
  await expect(page.getByRole("link", { name: "Archivio: 0" })).toHaveCount(0);
  await expect(page.getByText("Da tenere d'occhio")).not.toBeVisible();

  // Un passo della continuità porta dove si fa: l'eredità digitale.
  await continuity.getByRole("link", { name: "Attiva →" }).click();
  await expect(page).toHaveURL(/\/legacy$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Eredità digitale", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Oggi" }).click();

  // Una scadenza vicina compare tra le "Scadenze vicine".
  await openArchiveTab(page, "Scadenze");
  await page.getByRole("link", { name: "+ Crea scadenza" }).click();
  const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Titolo").fill("Bollo auto");
  await page.getByLabel("Data").fill(soon);
  await page.getByRole("button", { name: "Aggiungi scadenza" }).click();
  await expect(page).toHaveURL(/\/reminders$/, { timeout: 15_000 });
  await page.getByRole("link", { name: "Oggi" }).click();
  await expect(page.getByRole("region", { name: "Scadenze vicine" }).getByText("Bollo auto")).toBeVisible({ timeout: 15_000 });

  // Un amico guardiano fa salire il punteggio. Amico + guardiano richiederebbe una doppia richiesta di consenso
  // reale tra due account (v. friends.spec.ts per quel flusso): qui serve solo come dato di partenza, quindi si forza
  // direttamente via il client admin (v. test-users.ts).
  await page.getByRole("link", { name: "Amici", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Scheda di Maria Rossi" })).toBeVisible({ timeout: 10_000 });
  await forceOwnFriendToGuardian(user.email);
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("region", { name: "Scheda di Maria Rossi" }).getByText("🛡️ Guardiano")).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("link", { name: "Oggi" }).click();
  await expect(continuity.getByText("1 su 4")).toBeVisible({ timeout: 15_000 });
  await expect(continuity.getByText("Hai un guardiano che può confermare la tua assenza")).toBeVisible();
});
