import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openSettings } from "./settings-nav";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("Impostazioni > Onboarding mostra la percentuale, un messaggio e le attività con descrizione e stato, e può nascondere/mostrare il gadget nella barra", async ({
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

  // Si naviga a Impostazioni via menu utente (link, non page.goto): la
  // master key vive solo in memoria e una navigazione vera la perderebbe,
  // ma questa scheda la richiede (v. RequireMasterKey in SettingsTabs).
  await openSettings(page, user);
  await page.getByRole("tab", { name: "Onboarding" }).click();

  // Percentuale in grande (2/7 -> 29%) e messaggio di incoraggiamento accanto.
  await expect(page.getByText("29%")).toBeVisible();
  await expect(
    page.getByText("Un buon inizio: completa i prossimi passi per iniziare a vedere il valore di Hinthial."),
  ).toBeVisible();

  // Sotto, la lista delle attività con una breve descrizione e lo stato.
  const storyRow = page.getByRole("listitem").filter({ hasText: "Racconta un primo ricordo" });
  await expect(
    storyRow.getByText("Rispondi a una domanda di Raccontami: diventa un racconto cifrato, da far arrivare a chi vuoi."),
  ).toBeVisible();
  await expect(storyRow.getByRole("button", { name: "Da fare" })).toBeVisible();

  const accountRow = page.getByRole("listitem").filter({ hasText: "Crea un account" });
  await expect(accountRow.getByText("Fatto")).toBeVisible();

  // Un click su "Da fare" porta alla sezione dove completare il passo.
  await storyRow.getByRole("button", { name: "Da fare" }).click();
  await expect(page.getByRole("heading", { name: "Raccontami", level: 1 })).toBeVisible({ timeout: 15_000 });

  // Il gadget è visibile di default nella barra laterale...
  const statusButton = page.getByRole("button", { name: /Onboarding/ });
  await expect(statusButton).toBeVisible({ timeout: 10_000 });

  // ...e il pulsante in Impostazioni > Onboarding lo nasconde, senza
  // bisogno di passare dal pannello del gadget stesso.
  await openSettings(page, user);
  await page.getByRole("tab", { name: "Onboarding" }).click();
  await page
    .getByRole("button", { name: "Nascondi l'indicatore dalla barra di navigazione" })
    .click();
  await expect(
    page.getByRole("button", { name: "Mostra di nuovo l'indicatore nella barra di navigazione" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Oggi" }).click();
  await expect(statusButton).not.toBeVisible();

  // Farlo ricomparire funziona allo stesso modo, in entrambe le direzioni.
  await openSettings(page, user);
  await page.getByRole("tab", { name: "Onboarding" }).click();
  await page
    .getByRole("button", { name: "Mostra di nuovo l'indicatore nella barra di navigazione" })
    .click();
  await page.getByRole("link", { name: "Oggi" }).click();
  await expect(statusButton).toBeVisible({ timeout: 10_000 });
});
