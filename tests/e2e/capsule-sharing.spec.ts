import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";
import { openRowMenu } from "./row-actions";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * Verifica end-to-end del vero scambio di chiavi (ECDH P-256 + AES-GCM ibrido, v. lib/crypto/keypair.ts): il
 * proprietario chiude e condivide una capsula con un amico collegato, e quell'account la ritrova, la apre e legge
 * lo stesso contenuto, decifrato con la propria Master Key. L'ordine conta: il destinatario deve avere già la
 * propria coppia di chiavi PRIMA che il proprietario condivida, altrimenti la condivisione è best-effort e
 * silenziosa (v. createOrRefreshShareKey) --- qui si sblocca il destinatario per primo apposta.
 */
test("chiudere e condividere una capsula la rende apribile dal destinatario collegato, con lo stesso contenuto", async ({
  page,
}) => {
  test.slow();

  const recipient = uniqueTestUser();
  const owner = uniqueTestUser();
  await createConfirmedTestUser(recipient);
  await createConfirmedTestUser(owner);

  // Il destinatario si sblocca per primo: guadagna così la propria coppia di chiavi ECDH prima che il proprietario condivida.
  await page.goto("/login");
  await page.getByLabel("Email").fill(recipient.email);
  await page.getByLabel("Password").fill(recipient.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Capsule" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();

  await page.getByRole("button", { name: fullName(recipient) }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Il proprietario: crea l'amico con l'email del destinatario (si collega da solo), lo segna attivo e gli dedica una capsula.
  await page.goto("/login");
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password").fill(owner.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Amici" }).click();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Conferma master password").fill("una-master-password-solida");
  await page.getByRole("button", { name: "Crea" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Ho salvato la recovery key in un posto sicuro.").check();
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { name: "Amici" })).toBeVisible();

  await page.getByRole("link", { name: "+ Aggiungi amico" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo amico" })).toBeVisible();
  await page.getByLabel("Nome visualizzato").fill("Destinatario Collegato");
  await page.getByLabel("Email").fill(recipient.email);
  await page.getByLabel("Ruolo").fill("Amico");
  await page.getByRole("button", { name: "Aggiungi amico" }).click();
  await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });

  const friendScheda = page.getByRole("region", { name: "Scheda di Destinatario Collegato" });
  await expect(friendScheda).toBeVisible({ timeout: 10_000 });
  await expect(friendScheda.getByText("Ha un account Hinthial")).toBeVisible({ timeout: 15_000 });
  // Nasce già "Attivo": niente concetto di "In attesa" da sbloccare a mano.
  await expect(friendScheda.getByText("Attivo")).toBeVisible({ timeout: 10_000 });

  // Capsula con data di apertura già nel passato: non serve aspettare per verificare che l'apertura funzioni davvero.
  const secretMessage = `messaggio segreto per la condivisione --- ${Date.now()}`;
  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();
  await page.getByRole("link", { name: "+ Crea capsula" }).click();
  await expect(page.getByRole("heading", { name: "Nuova capsula" })).toBeVisible();

  await page.getByLabel("Titolo").fill("Per il destinatario collegato");
  await page.getByLabel("Data e ora di apertura", { exact: true }).fill("2024-01-01T10:00");
  await page.locator("#create-friend").selectOption({ label: "Destinatario Collegato" });
  await page.getByRole("button", { name: "+ Aggiungi" }).click();
  await expect(page.getByText("Destinatario Collegato")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 2 di 3")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText("Passo 3 di 3")).toBeVisible();
  await page.getByLabel("Il tuo messaggio").fill(secretMessage);
  await page.getByRole("button", { name: "Crea capsula" }).click();

  await expect(page).toHaveURL(/\/capsules$/, { timeout: 15_000 });
  await expect(page.getByText("Capsula creata.")).toBeVisible();

  const capsuleRow = page.locator("li", { hasText: "Per il destinatario collegato" });
  await expect(capsuleRow).toBeVisible({ timeout: 15_000 });

  // Chiudi (irreversibile, conferma esplicita) e condividi: solo a questo punto scatta la vera cifratura ibrida per il destinatario.
  await openRowMenu(capsuleRow);
  await page.getByRole("menuitem", { name: "Chiudi la capsula" }).click();
  await page.getByRole("dialog", { name: "Prima di chiudere la capsula" }).getByRole("button", { name: "Chiudi la capsula" }).click();
  await expect(capsuleRow.getByText("Chiusa", { exact: true })).toBeVisible({ timeout: 10_000 });

  await openRowMenu(capsuleRow);
  await page.getByRole("menuitem", { name: "Condividi" }).click();
  await expect(capsuleRow.getByText("Condivisa")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: fullName(owner) }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Il destinatario ritrova la capsula in "Condivise con me", la apre e legge lo stesso contenuto, decifrato con la propria Master Key via lo scambio ECDH.
  await page.goto("/login");
  await page.getByLabel("Email").fill(recipient.email);
  await page.getByLabel("Password").fill(recipient.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Sblocca" })).toBeVisible();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();

  await page.getByRole("tab", { name: /Condivise con me/ }).click();
  const sharedItem = page.locator("li", { hasText: `Da ${fullName(owner)}` });
  await expect(sharedItem).toBeVisible({ timeout: 15_000 });

  const openButton = sharedItem.getByRole("button", { name: "🔓 Apri" });
  await expect(openButton).toBeVisible({ timeout: 10_000 });
  await openButton.click();

  const viewer = page.getByRole("dialog", { name: "Capsula condivisa" });
  await expect(viewer).toBeVisible();

  // La capsula arriva come una busta sigillata, con il titolo ma non ancora la lettera: si rompe il sigillo per leggerla.
  await expect(viewer.getByText("Per il destinatario collegato")).toBeVisible({ timeout: 15_000 });
  await expect(viewer.getByText(secretMessage)).toHaveCount(0);
  await viewer.getByRole("button", { name: "Rompi il sigillo" }).click();
  await expect(viewer.getByText(secretMessage)).toBeVisible();

  // Lascia un pensiero a chi l'ha scritta: cifrato sul dispositivo per il proprietario.
  const pensiero = viewer.getByRole("region", { name: "Lascia un pensiero" });
  await expect(pensiero.getByRole("button", { name: "Invia il pensiero" })).toBeDisabled();
  await pensiero.getByLabel(/^Due righe per/).fill("Grazie, l'ho letta tre volte.");
  await pensiero.getByRole("button", { name: "Invia il pensiero" }).click();
  await expect(pensiero.getByText(/Il tuo pensiero è arrivato a/)).toBeVisible({ timeout: 15_000 });
  await expect(pensiero.getByRole("button", { name: "Ritira il pensiero" })).toBeVisible();

  await viewer.getByRole("button", { name: "Chiudi" }).click();
  await page.getByRole("button", { name: fullName(recipient) }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Il proprietario ritrova il pensiero sulla busta e lo legge, con il nome di chi l'ha scritto.
  await page.goto("/login");
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password").fill(owner.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Capsule" }).click();
  await expect(page.getByRole("heading", { name: "Sblocca" })).toBeVisible();
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByRole("button", { name: "Sblocca", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Capsule" })).toBeVisible();

  await page.getByRole("button", { name: "Leggi 1 pensiero su Per il destinatario collegato" }).click();
  const pensieri = page.getByRole("dialog", { name: "Pensieri ricevuti" });
  await expect(pensieri.getByText("Grazie, l'ho letta tre volte.")).toBeVisible({ timeout: 15_000 });
  await expect(pensieri.getByText(fullName(recipient))).toBeVisible();

  // Lo toglie dalla raccolta: la busta non ne segnala più.
  await pensieri.getByRole("button", { name: "Togli" }).click();
  await expect(pensieri.getByText("Nessun pensiero, per ora.")).toBeVisible({ timeout: 10_000 });
  await pensieri.getByRole("button", { name: "Chiudi" }).click();
  await expect(page.getByRole("button", { name: /Leggi .* pensier/ })).toHaveCount(0);
});
