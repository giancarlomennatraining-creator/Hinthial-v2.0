import { expect, test } from "./fixtures";
import { createConfirmedTestUser, forceOwnFriendToGuardian, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("l'indicatore \"Onboarding\" nella barra laterale mostra la percentuale e apre la checklist al click", async ({
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

  // Prima dello sblocco della cifratura, l'indicatore mostra già i primi
  // due passi (account fatto, cifratura no): 1 su 2 -> 50%. Un punto di
  // partenza esplicito, invece di restare assente finché non si è già
  // configurata la cifratura da sé.
  const statusButton = page.getByRole("button", { name: /Onboarding/ });
  const panel = page.getByRole("dialog", { name: "Onboarding" });
  await expect(statusButton).toBeVisible({ timeout: 10_000 });
  await expect(statusButton).toHaveAttribute("aria-label", "Onboarding: 50% completato");
  await statusButton.click();
  await expect(panel).toBeVisible();
  await expect(panel.getByText("1/2")).toBeVisible();
  await expect(panel.getByRole("link", { name: "Configura la cifratura" })).toHaveAttribute(
    "href",
    "/archive",
  );
  await page.getByRole("button", { name: "Chiudi" }).click();
  await expect(panel).not.toBeVisible();

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

  // Account e cifratura fatti, nient'altro ancora: 2 su 8 -> 25%.
  await expect(statusButton).toBeVisible({ timeout: 10_000 });
  await expect(statusButton).toHaveAttribute("aria-label", "Onboarding: 25% completato");

  await statusButton.click();
  await expect(panel).toBeVisible();
  await expect(panel.getByText("2/8")).toBeVisible();
  await expect(panel.getByRole("link", { name: "Aggiungi il primo contenuto all'archivio" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Aggiungi un guardiano" })).toBeVisible();
  await expect(panel.getByText("(opzionale)")).toHaveCount(0);

  // Il pulsante "Chiudi" (o un click sullo sfondo) lo richiude --- un
  // pannello laterale a tutto schermo, come il dettaglio attività in
  // Impostazioni > Attività (v. AuditLogPanel).
  await page.getByRole("button", { name: "Chiudi" }).click();
  await expect(panel).not.toBeVisible();

  // Un documento con categoria completa due passi in un colpo solo.
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

  // Riaprendolo si aggiorna: 4 su 8 -> 50%.
  await statusButton.click();
  await expect(statusButton).toHaveAttribute("aria-label", "Onboarding: 50% completato", {
    timeout: 10_000,
  });
  await expect(panel.getByText("4/8")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi" }).click();

  // Un guardiano completa un altro passo: 5 su 8 -> 63%.
  await page.getByRole("link", { name: "Amici", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  const friendRow = page.locator("li", { hasText: "Maria Rossi" });
  await expect(friendRow).toBeVisible({ timeout: 10_000 });
  // Amico + guardiano richiederebbe ora una doppia richiesta di consenso
  // reale tra due account (v. friends.spec.ts per quel flusso) --- qui
  // serve solo come dato di partenza per il passo "guardian", quindi si
  // forza direttamente via il client admin (v. test-users.ts).
  await forceOwnFriendToGuardian(user.email);
  await page.reload();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(friendRow.getByText("🛡️ Guardiano")).toBeVisible({ timeout: 10_000 });

  await statusButton.click();
  await expect(statusButton).toHaveAttribute("aria-label", "Onboarding: 63% completato", {
    timeout: 10_000,
  });
  await expect(panel.getByText("5/8")).toBeVisible();

  // "Nascondi" fa sparire il gadget subito, e la scelta resta anche dopo
  // un refresh --- sincronizzata sul server (come nav_orientation), quindi
  // vale anche a un login successivo, non solo per questa sessione.
  await panel.getByRole("button", { name: "Nascondi" }).click();
  await expect(statusButton).not.toBeVisible();
  await expect(panel).not.toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Sblocca" })).toBeVisible();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Amici" })).toBeVisible();
  await expect(statusButton).not.toBeVisible();
});
