import { expect, test, type Page } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

/**
 * Con cinque capsule la pagina scorre: il menu "⋮" si chiude a ogni scroll (v. RowActionsMenu), e un evento di scroll arriva
 * un attimo dopo che la riga è stata portata in vista, proprio quando il test ha già aperto il menu. Si porta quindi la riga in
 * vista e si lascia assestare lo scorrimento prima di aprirlo.
 */
async function openMenuOf(row: Parameters<typeof openRowMenu>[0], page: Page) {
  await row.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await openRowMenu(row);
}

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Il mittente sceglie, capsula per capsula, con quale effetto la vedrà chi la riceve; il destinatario la apre e vede proprio
// quell'effetto. L'effetto viaggia nel payload cifrato (nessuna migrazione): qui si crea una capsula per ciascuno dei cinque
// effetti, si condividono, e il destinatario le apre tutte verificando che ognuna si presenti a modo suo.

const PASSWORD = "una-master-password-solida";
const EFFECTS = [
  { value: "zoom", label: /^Zoom nell'oblò/ },
  { value: "hold", label: /^Tieni premuto/ },
  { value: "deck", label: /^Ricordi uno a uno/ },
  { value: "light", label: /^Luce e lettera/ },
  { value: "discreet", label: /^Sblocco discreto/ },
] as const;
const MESSAGE = "Un pensiero per te";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

async function createMasterKey(page: Page, section: string, heading: string) {
  await page.getByRole("link", { name: section }).click();
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Conferma master password").fill(PASSWORD);
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(page.getByLabel("Ho salvato la recovery key in un posto sicuro.")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

async function logout(page: Page, name: string) {
  await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("ogni capsula si apre per chi la riceve con l'effetto scelto da chi l'ha scritta", async ({ page }) => {
  test.setTimeout(420_000);

  const recipient = uniqueTestUser();
  const owner = uniqueTestUser();
  await createConfirmedTestUser(recipient);
  await createConfirmedTestUser(owner);

  // Il destinatario si sblocca per primo: guadagna così la propria coppia di chiavi prima che il proprietario condivida.
  await login(page, recipient.email, recipient.password);
  await createMasterKey(page, "Capsule", "Capsule");
  await logout(page, fullName(recipient));

  // Il proprietario: un amico collegato e cinque capsule, una per effetto, già "aperte" (data nel passato).
  await login(page, owner.email, owner.password);
  await createMasterKey(page, "Amici", "Amici");
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await page.getByLabel("Nome visualizzato").fill("Destinatario Collegato");
  await page.getByLabel("Email").fill(recipient.email);
  await page.getByLabel("Ruolo").fill("Amico");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
  const scheda = page.getByRole("region", { name: "Scheda di Destinatario Collegato" });
  await expect(scheda.getByText("Ha un account Hinthial")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "Capsule", exact: true }).click();
  for (const { value, label } of EFFECTS) {
    await page.getByRole("link", { name: "+ Crea capsula" }).click();
    await page.getByLabel("Titolo").fill(`Capsula ${value}`);
    await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2024-01-01T10:00");
    await page.locator("#create-friend").selectOption({ label: "Destinatario Collegato" });
    await page.getByRole("button", { name: "+ Aggiungi" }).click();
    await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByLabel("Il tuo messaggio").fill(MESSAGE);
    await page.getByRole("radio", { name: label }).click();
    await expect(page.getByRole("radio", { name: label })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Crea capsula" }).click();
    await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
    await expect(page.getByRole("listitem").filter({ hasText: `Capsula ${value}` })).toBeVisible({ timeout: 15_000 });
  }

  for (const { value } of EFFECTS) {
    const row = page.getByRole("listitem").filter({ hasText: `Capsula ${value}` });
    await openMenuOf(row, page);
    await page.getByRole("menuitem", { name: "Chiudi la capsula" }).click();
    await page.getByRole("dialog", { name: "Prima di chiudere la capsula" }).getByRole("button", { name: "Chiudi la capsula" }).click();
    await expect(row.getByText("Chiusa", { exact: true })).toBeVisible({ timeout: 15_000 });
    // Si aspetta che la pagina si assesti (conto alla rovescia e avviso): il menu si chiude se la pagina scorre mentre è aperto.
    await expect(row.getByText("Disponibile da adesso")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Capsula chiusa.")).toBeHidden({ timeout: 15_000 });
    await openMenuOf(row, page);
    await page.getByRole("menuitem", { name: "Condividi" }).click();
    await expect(row.getByText("Condivisa")).toBeVisible({ timeout: 15_000 });
  }
  await logout(page, fullName(owner));

  // Il destinatario le apre una per una: ognuna con il suo effetto, e tutte con la stessa lettera.
  await login(page, recipient.email, recipient.password);
  await page.getByRole("link", { name: "Capsule", exact: true }).click();
  await page.getByLabel("Master password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();
  await page.getByRole("tab", { name: /Condivise con me/ }).click();
  const aperture = page.getByRole("button", { name: "🔓 Apri" });
  await expect(aperture).toHaveCount(EFFECTS.length, { timeout: 20_000 });
  // Con la data arrivata, ogni capsula si presenta come pronta da aprire.
  await expect(page.getByText("Pronta da aprire")).toHaveCount(EFFECTS.length);

  const seen: string[] = [];
  for (let i = 0; i < EFFECTS.length; i++) {
    await aperture.nth(i).click();
    const finestra = page.getByRole("dialog", { name: "Capsula condivisa" });
    await expect(finestra).toBeVisible({ timeout: 15_000 });
    await expect(finestra).toHaveAttribute("data-effect", /.+/, { timeout: 15_000 });
    const effect = (await finestra.getAttribute("data-effect")) as string;
    seen.push(effect);

    if (effect === "hold") {
      // Si tiene premuto l'oblò (da tastiera, Invio) e la capsula si legge nel foglio che compare.
      await finestra.getByRole("button", { name: "Tieni premuto per aprire la capsula" }).press("Enter");
    }
    if (effect === "light") {
      await finestra.getByRole("button", { name: "Salta" }).click();
    }
    if (effect === "deck") {
      await expect(finestra.getByText("Ricordo 1 di 1")).toBeVisible({ timeout: 10_000 });
    }
    await expect(finestra.getByText(MESSAGE)).toBeVisible({ timeout: 15_000 });
    if (effect === "deck") {
      await finestra.getByRole("button", { name: "Avanti" }).click();
      await expect(finestra.getByText("Per finire")).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(finestra).toHaveCount(0);
  }

  expect([...seen].sort()).toEqual(EFFECTS.map((e) => e.value).sort());
});
