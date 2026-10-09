import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";
import { openSettings } from "./settings-nav";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("Impostazioni > Attività si interroga con filtri (area, elemento) e apre il dettaglio di un evento", async ({
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

  // Il login stesso è già un evento --- consultabile subito, senza
  // sbloccare la cifratura (è un registro tecnico in chiaro). L'elenco si
  // carica da solo, senza premere nulla.
  await openSettings(page, user);
  await page.getByRole("tab", { name: "Attività" }).click();

  // Le schede di Impostazioni possono montare il pannello due volte (mobile/desktop): si lavora su ciò che si vede.
  const table = () => page.getByRole("table").filter({ visible: true });
  const area = () => page.getByLabel("Area").filter({ visible: true });
  await expect(table().getByText("Accesso effettuato")).toBeVisible();

  // Il metodo di login è tra i dettagli, visibili aprendo la riga.
  await table().getByText("Accesso effettuato").click();
  const detail = page.getByRole("dialog", { name: "Dettaglio attività" });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Password")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi" }).click();
  await expect(detail).not.toBeVisible();

  // Il filtro per area funziona in entrambe le direzioni, vive nell'URL e si azzera con un clic.
  await area().selectOption({ label: "Archivio" });
  await expect(page.getByText("Nessuna attività trovata con questi filtri.").filter({ visible: true })).toBeVisible();
  await area().selectOption({ label: "Accessi" });
  await expect(table().getByText("Accesso effettuato")).toBeVisible();
  await expect(page).toHaveURL(/area=access/);

  await page.reload();
  await expect(area()).toHaveValue("access");
  await expect(table().getByText("Accesso effettuato")).toBeVisible();

  await page.getByRole("button", { name: "Azzera filtri" }).filter({ visible: true }).click();
  await expect(area()).toHaveValue("");
  await expect(page).not.toHaveURL(/area=/);

  // Configurare la cifratura e aggiungere un contenuto/bene/contatto
  // registrano a loro volta un evento --- verificabile tornando qui.
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

  await page.getByRole("button", { name: "+ Aggiungi contenuto" }).click();
  await page.getByRole("menuitem", { name: "Carica un file" }).click();
  // Il passo 1 non parte più su una modalità già scelta (v. feedback utente): va scelta esplicitamente.
  await page.getByRole("radio", { name: /Carica un file/ }).click();
  await page.setInputFiles('input[type="file"]', {
    name: "polizza.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("polizza di prova"),
  });
  await page.getByRole("button", { name: "Aggiungi all'archivio" }).click();
  await page.getByRole("link", { name: "Torna all'archivio", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Amici", exact: true }).click();
  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await page.getByLabel("Nome visualizzato").fill("Maria Rossi");
  await page.getByLabel("Email").fill("maria.rossi@esempio.it");
  await page.getByLabel("Ruolo").fill("Coniuge");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });

  await openSettings(page, user);
  await page.getByRole("tab", { name: "Attività" }).click();

  // Ora anche le azioni sui contenuti stanno qui, ciascuna agganciata al proprio elemento.
  await expect(table().getByText("Amico aggiunto")).toBeVisible({ timeout: 10_000 });
  await expect(table().getByText("Contenuto aggiunto all'archivio")).toBeVisible();
  // Con il vault sbloccato la colonna Elemento mostra il nome in chiaro.
  await expect(table().getByText("Maria Rossi")).toBeVisible({ timeout: 10_000 });

  // Scegliere un elemento dall'elenco lascia solo i suoi eventi.
  await page.getByLabel("Elemento").filter({ visible: true }).selectOption({ label: "Maria Rossi" });
  await expect(table().getByText("Amico aggiunto")).toBeVisible();
  await expect(table().getByText("Contenuto aggiunto all'archivio")).not.toBeVisible();
});
