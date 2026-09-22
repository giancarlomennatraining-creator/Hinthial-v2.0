import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("compilare la scheda d'emergenza aggiorna l'anteprima, si salva e sopravvive a un refresh", async ({
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

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Scheda d'emergenza" }).click();
  await expect(page.getByRole("heading", { name: "Scheda d'emergenza" })).toBeVisible();

  // Vuota all'inizio: niente da stampare ancora.
  await expect(page.getByRole("button", { name: "🖨️ Stampa scheda (formato tessera)" })).toBeDisabled();

  await page.getByLabel("Gruppo sanguigno").selectOption("0+");
  await page.getByLabel("Allergie").fill("Penicillina, arachidi");
  await page.getByLabel("Condizioni rilevanti").fill("Asma lieve");
  await page.getByLabel("Nome del medico di riferimento").fill("Dr. Elena Ferri");
  await page.getByLabel("Telefono del medico di riferimento").fill("02 1234567");

  await page.getByRole("button", { name: "+ Aggiungi un contatto" }).click();
  await page.getByLabel("Nome del contatto 1").fill("Marco Rossi");
  await page.getByLabel("Relazione del contatto 1").fill("Fratello");
  await page.getByLabel("Telefono del contatto 1").fill("333 1234567");

  // L'anteprima --- la stessa cosa che finirebbe sulla tessera stampata
  // --- si aggiorna mentre si scrive, non solo dopo il salvataggio.
  // .first(): la stessa tessera compare una seconda volta nel blocco
  // "solo stampa" fuori vista (v. EmergencyCardPanel.tsx), invisibile a
  // schermo ma comunque nel DOM --- stesso schema di recovery-kit.spec.ts.
  await expect(page.getByText("🩸 Gruppo 0+").first()).toBeVisible();
  await expect(page.getByText("Penicillina, arachidi").first()).toBeVisible();
  await expect(page.getByText("🩺 Dr. Elena Ferri (medico di base)", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Marco Rossi (Fratello)").first()).toBeVisible();

  await expect(page.getByRole("button", { name: "🖨️ Stampa scheda (formato tessera)" })).toBeEnabled();

  await page.getByRole("button", { name: "Salva e aggiorna la scheda" }).click();
  await expect(page.getByText("Scheda d'emergenza salvata.")).toBeVisible();

  // Un reload azzera la master key dalla memoria (mai persistita, per
  // costruzione) --- questa scheda la richiede, a differenza di quella
  // dei soli parametri: va sbloccata di nuovo per rivederla.
  await page.reload();
  await page.getByRole("tab", { name: "Scheda d'emergenza" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByLabel("Gruppo sanguigno")).toHaveValue("0+");
  await expect(page.getByLabel("Allergie")).toHaveValue("Penicillina, arachidi");
  await expect(page.getByLabel("Nome del contatto 1")).toHaveValue("Marco Rossi");
  await expect(page.getByText("🩺 Dr. Elena Ferri (medico di base)", { exact: true }).first()).toBeVisible();

  // Rimuovere il contatto lo toglie dall'anteprima, il medico resta.
  await page.getByRole("button", { name: "Rimuovi il contatto 1" }).click();
  await expect(page.getByText("Marco Rossi (Fratello)")).not.toBeVisible();
  await expect(page.getByText("🩺 Dr. Elena Ferri (medico di base)", { exact: true }).first()).toBeVisible();
});
