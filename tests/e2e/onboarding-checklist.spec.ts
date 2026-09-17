import { expect, test } from "./fixtures";
import { createConfirmedTestUser, forceOwnFriendToGuardian, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("la checklist \"Onboarding\", nel pannello dell'indicatore in barra laterale, mostra il progresso su tutti gli 8 passi (nessuno opzionale)", async ({
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

  // La checklist non vive più nel corpo della Dashboard (v. richiesta
  // utente): si verifica lo stesso avanzamento dal pannello
  // dell'indicatore persistente nella barra laterale (v. OnboardingStatus).
  const statusButton = page.getByRole("button", { name: /Onboarding/ });
  const panel = page.getByRole("dialog", { name: "Onboarding" });

  async function openPanel() {
    await statusButton.click();
    await expect(panel).toBeVisible();
  }
  async function closePanel() {
    await panel.getByRole("button", { name: "Chiudi" }).click();
    await expect(panel).not.toBeVisible();
  }

  // Account e cifratura già fatti, nient'altro: 2/8. Nessuna voce è
  // marcata "(opzionale)" --- non esiste più questa distinzione.
  await openPanel();
  await expect(panel.getByText("2/8")).toBeVisible();
  await expect(panel.getByText("(opzionale)")).toHaveCount(0);
  await expect(
    panel.getByRole("link", { name: "Aggiungi il primo contenuto all'archivio" }),
  ).toBeVisible();
  await closePanel();

  // Un documento con una categoria assegnata completa due passi in un colpo solo. 4/8.
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
  await openPanel();
  await expect(panel.getByText("4/8")).toBeVisible();
  // La voce completata resta elencata, non barrata.
  const doneDocumentStep = panel.getByText("Aggiungi il primo contenuto all'archivio");
  await expect(doneDocumentStep).toBeVisible();
  await expect(doneDocumentStep).not.toHaveClass(/line-through/);
  await closePanel();

  // Un bene: 5/8.
  await page.getByRole("link", { name: "Beni", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill("Barca");
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Dashboard" }).click();
  await openPanel();
  await expect(panel.getByRole("link", { name: "Aggiungi il primo bene" })).not.toBeVisible();
  await expect(panel.getByText("5/8")).toBeVisible();
  await closePanel();

  // Un amico, attivo (per poter poi ricevere una capsula) e guardiano
  // (completa il passo "guardian"): 6/8.
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

  await page.getByRole("link", { name: "Dashboard" }).click();
  await openPanel();
  await expect(panel.getByText("6/8")).toBeVisible();
  await closePanel();

  // Una capsula con quell'amico come destinatario completa insieme
  // "capsula" e "collegamento capsula-amico": 8/8, checklist sparita.
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

  // 8/8: la checklist, nel pannello, mostra il rapporto completo ---
  // resta comunque elencata (v. OnboardingChecklist), solo l'indicatore
  // che la apre passa a mostrare una percentuale invece che un rapporto.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await openPanel();
  await expect(panel.getByText("8/8")).toBeVisible();
  await closePanel();

  // L'indicatore nella barra laterale si ricarica solo all'apertura del
  // pannello (v. OnboardingStatus): un click lo forza ad aggiornarsi al
  // nuovo 100%.
  await statusButton.click();
  await expect(statusButton).toHaveAttribute("aria-label", "Onboarding: 100% completato", {
    timeout: 10_000,
  });

  // A 100% l'anello dell'indicatore diventa verde (era il colore del
  // brand) --- è un conic-gradient (background-image), non un colore
  // pieno, quindi si verifica lì il valore rgb del verde usato.
  const ring = statusButton.locator("span").first();
  await expect(ring).toHaveCSS("background-image", /34, 197, 94/);
});
