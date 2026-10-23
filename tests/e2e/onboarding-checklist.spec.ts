import { expect, test } from "./fixtures";
import { createConfirmedTestUser, forceOwnFriendToGuardian, uniqueTestUser } from "./test-users";
import { acceptConfirm } from "./confirm-dialog";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("la checklist \"Onboarding\" segue i pilastri: racconto, persona, capsula per lei, guardiano, Eredità digitale (7 passi)", async ({
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

  // La checklist vive nel pannello dell'indicatore persistente in barra laterale.
  const statusButton = page.getByRole("button", { name: /Onboarding/ });
  const panel = page.getByRole("dialog", { name: "Onboarding" });

  async function expectProgress(count: string) {
    await statusButton.click();
    await expect(panel).toBeVisible();
    await expect(panel.getByText(count)).toBeVisible({ timeout: 10_000 });
  }
  async function closePanel() {
    await panel.getByRole("button", { name: "Chiudi" }).click();
    await expect(panel).not.toBeVisible();
  }

  // Account e chiave già fatti, nient'altro: 2/7, nessuna voce "(opzionale)".
  await expectProgress("2/7");
  await expect(panel.getByText("(opzionale)")).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "Racconta un primo ricordo" })).toBeVisible();
  await closePanel();

  // Raccontami: una risposta diventa il primo racconto. 3/7.
  await page.getByRole("link", { name: "Raccontami", exact: true }).click();
  const domanda = page.getByRole("region", { name: "Domanda" });
  await expect(domanda.getByLabel("La tua risposta")).toBeVisible({ timeout: 15_000 });
  await domanda.getByLabel("La tua risposta").fill("A Sassoferrato, in una casa con il pozzo in cortile.");
  await domanda.getByRole("button", { name: "Salva il racconto" }).click();
  await expect(domanda.getByText("Racconto salvato")).toBeVisible({ timeout: 20_000 });
  await expectProgress("3/7");
  // La voce completata resta elencata, non barrata.
  const doneStory = panel.getByText("Racconta un primo ricordo");
  await expect(doneStory).toBeVisible();
  await expect(doneStory).not.toHaveClass(/line-through/);
  await closePanel();

  // Una persona in Amici: 4/7. Come guardiano (forzato via admin, v. friends.spec.ts per il flusso vero): 5/7.
  await page.getByRole("link", { name: "Amici", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  const friendRow = page.getByRole("region", { name: "Rubrica" }).getByRole("button", { name: /Maria Rossi/ });
  await expect(friendRow).toBeVisible({ timeout: 10_000 });
  await expectProgress("4/7");
  await closePanel();

  await forceOwnFriendToGuardian(user.email);
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(friendRow.getByTitle("Guardiano")).toBeVisible({ timeout: 10_000 });
  await expectProgress("5/7");
  await closePanel();

  // Una capsula per Maria: 6/7.
  await page.getByRole("link", { name: "Capsule", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();
  await page.getByLabel("Titolo").fill("Per Maria");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2027-01-01T10:00");
  await page.locator("#create-friend").selectOption({ label: "Maria Rossi" });
  await page.getByRole("button", { name: "+ Aggiungi" }).click();
  await expect(page.getByText("Maria Rossi")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await page.getByLabel("Il tuo messaggio").fill("Un pensiero per te.");
  await page.getByRole("button", { name: "Crea capsula" }).click();
  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("Capsula creata.")).toBeVisible();
  await expectProgress("6/7");
  await closePanel();

  // L'Eredità digitale attivata e salvata: 7/7.
  await page.getByRole("link", { name: "Eredità digitale", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Eredità digitale", level: 1 })).toBeVisible();
  const enableToggle = page.getByRole("checkbox", { name: "Attiva Eredità digitale" });
  await enableToggle.click();
  await acceptConfirm(page);
  await expect(enableToggle).toBeChecked();
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    page.getByRole("button", { name: "Salva", exact: true }).click(),
  ]);
  await expect(page.getByText("Impostazioni di Eredità digitale salvate.")).toBeVisible();
  await expectProgress("7/7");
  await closePanel();

  // L'indicatore si ricarica all'apertura del pannello: a 100% l'anello diventa verde (un conic-gradient).
  await statusButton.click();
  await expect(statusButton).toHaveAttribute("aria-label", "Onboarding: 100% completato", { timeout: 10_000 });
  const ring = statusButton.locator("span").first();
  await expect(ring).toHaveCSS("background-image", /34, 197, 94/);
});
