import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("la checklist \"Onboarding\" mostra il progresso su tutti gli 8 passi (nessuno opzionale) e sparisce solo a lista completa", async ({
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

  // Account e cifratura già fatti, nient'altro: 2/8. Nessuna voce è
  // marcata "(opzionale)" --- non esiste più questa distinzione.
  // "Onboarding" compare due volte in pagina (la card qui e l'indicatore
  // nella barra laterale): si verifica la card dal rapporto "2/8", che
  // solo lei mostra.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText("2/8")).toBeVisible();
  await expect(page.getByText("(opzionale)")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Aggiungi il primo contenuto all'archivio" }),
  ).toBeVisible();

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
  await expect(page.getByText("4/8")).toBeVisible();
  // La voce completata resta elencata, non barrata.
  const doneDocumentStep = page.getByText("Aggiungi il primo contenuto all'archivio");
  await expect(doneDocumentStep).toBeVisible();
  await expect(doneDocumentStep).not.toHaveClass(/line-through/);

  // Un bene: 5/8.
  await page.getByRole("link", { name: "Beni", exact: true }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill("Barca");
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("link", { name: "Aggiungi il primo bene" })).not.toBeVisible();
  await expect(page.getByText("5/8")).toBeVisible();

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
  await openRowMenu(friendRow);
  await page.getByRole("menuitem", { name: "Segna come attivo" }).click();
  await expect(friendRow.getByText("Attivo")).toBeVisible({ timeout: 10_000 });
  await openRowMenu(friendRow);
  await page.getByRole("menuitem", { name: "Segna come guardiano" }).click();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText("6/8")).toBeVisible();

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

  // La card sparisce: nessun rapporto "N/8" resta in pagina (l'indicatore
  // nella barra laterale mostra invece una percentuale, non un rapporto,
  // e resta comunque visibile --- v. onboarding-status.spec.ts).
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText(/\d+\/8/)).not.toBeVisible();

  // L'indicatore nella barra laterale si ricarica solo all'apertura del
  // pannello (v. OnboardingStatus), non ad ogni navigazione come la
  // card: un click lo forza ad aggiornarsi al nuovo 100%.
  const statusButton = page.getByRole("button", { name: /Onboarding/ });
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
