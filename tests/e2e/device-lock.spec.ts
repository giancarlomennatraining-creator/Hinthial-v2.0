import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Il vero autenticatore biometrico non è testabile in automatico ---
// usa l'autenticatore virtuale di Chrome DevTools Protocol (con
// `hasPrf: true`, l'estensione WebAuthn che rende possibile derivare
// davvero una chiave di cifratura, non solo "provare la presenza
// dell'utente") al posto dell'impronta/Face ID reale: stessa API del
// browser, stesso codice applicativo, solo la parte hardware è simulata.

async function addVirtualAuthenticator(page: import("@playwright/test").Page) {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
      hasPrf: true,
    },
  });
}

test("registra questo dispositivo come fidato e lo sblocca di nuovo con l'impronta, senza la master password", async ({
  page,
}) => {
  test.slow();
  await addVirtualAuthenticator(page);

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

  // Registra questo dispositivo --- richiede di nuovo la master
  // password (v. MasterKeyProvider.tsx, registerDeviceLock): è la sola
  // occasione in cui il Master Key diventa temporaneamente esportabile,
  // per poterlo cifrare per questo dispositivo.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Sicurezza" }).click();
  await expect(page.getByRole("heading", { name: "Dispositivi fidati", exact: true })).toBeVisible();
  // Il controllo di supporto (WebAuthn + PRF) è asincrono --- v.
  // MasterKeyProvider.tsx, isDeviceLockSupported --- attende che si
  // risolva prima di interagire con un modulo che potrebbe non esserci
  // ancora.
  await expect(page.getByText("Verifica del dispositivo in corso…")).not.toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Nome del dispositivo fidato").fill("Dispositivo di test");
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page
    .getByLabel("Capisco che chi ha accesso fisico a questo dispositivo")
    .check();
  await page.getByRole("button", { name: "Rendi fidato questo dispositivo" }).click();
  await expect(page.getByText("✓ Questo dispositivo è fidato")).toBeVisible({ timeout: 15_000 });

  // Una pagina intera da capo (come una nuova sessione: il Master Key
  // vive solo in memoria, mai persistito) --- il vault torna "locked".
  await page.reload();
  await expect(page.getByRole("tab", { name: "Sicurezza" })).toBeVisible();

  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sblocca" })).toBeVisible();
  const deviceLockButton = page.getByRole("button", { name: "Sblocca con impronta/Face ID" });
  await expect(deviceLockButton).toBeVisible({ timeout: 10_000 });
  await deviceLockButton.click();

  // Sbloccato senza aver mai (in questo giro) digitato la master
  // password --- solo l'autenticatore virtuale.
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible({ timeout: 15_000 });
});

test("\"dimentica questo dispositivo\" fa tornare a chiedere la master password", async ({ page }) => {
  test.slow();
  await addVirtualAuthenticator(page);

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

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Sicurezza" }).click();
  await page.getByLabel("Nome del dispositivo fidato").fill("Dispositivo di test");
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Capisco che chi ha accesso fisico a questo dispositivo").check();
  await page.getByRole("button", { name: "Rendi fidato questo dispositivo" }).click();
  await expect(page.getByText("✓ Questo dispositivo è fidato")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Dimentica questo dispositivo" }).click();
  await expect(page.getByRole("button", { name: "Rendi fidato questo dispositivo" })).toBeVisible({
    timeout: 10_000,
  });

  await page.reload();
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sblocca" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sblocca con impronta/Face ID" })).not.toBeVisible();
});

test("un dispositivo fidato compare nell'elenco anche da un altro dispositivo, e la revoca da lì lo disattiva davvero", async ({
  page,
  browser,
}) => {
  test.slow();
  await addVirtualAuthenticator(page);

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  // --- "Telefono": registra se stesso come dispositivo fidato. ---
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

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Sicurezza" }).click();
  await expect(page.getByText("Verifica del dispositivo in corso…")).not.toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Nome del dispositivo fidato").fill("Il mio telefono");
  await page.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await page.getByLabel("Capisco che chi ha accesso fisico a questo dispositivo").check();
  await page.getByRole("button", { name: "Rendi fidato questo dispositivo" }).click();
  await expect(page.getByText("✓ Questo dispositivo è fidato")).toBeVisible({ timeout: 15_000 });

  // --- "PC": un browser context a parte, stesso account --- vede "Il mio telefono" nell'elenco, e lo revoca da lì. ---
  const pcContext = await browser.newContext();
  const pcPage = await pcContext.newPage();
  await pcPage.goto("/login");
  await pcPage.getByLabel("Email").fill(user.email);
  await pcPage.getByLabel("Password").fill(user.password);
  await pcPage.getByRole("button", { name: "Accedi" }).click();
  await expect(pcPage).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await pcPage.getByRole("button", { name: fullName(user) }).click();
  await pcPage.getByRole("link", { name: "Impostazioni" }).click();
  await pcPage.getByRole("tab", { name: "Sicurezza" }).click();
  const deviceRow = pcPage.locator("li", { hasText: "Il mio telefono" });
  await expect(deviceRow).toBeVisible({ timeout: 15_000 });
  // Non è "questo dispositivo" dal punto di vista del PC --- niente etichetta.
  await expect(deviceRow.getByText("questo dispositivo")).not.toBeVisible();
  await deviceRow.getByRole("button", { name: "Revoca" }).click();
  await expect(deviceRow).not.toBeVisible({ timeout: 10_000 });
  await pcContext.close();

  // --- Di nuovo il "telefono": l'impronta non basta più, si autoguarisce e richiede la password. ---
  await page.reload();
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sblocca" })).toBeVisible();
  const deviceLockButton = page.getByRole("button", { name: "Sblocca con impronta/Face ID" });
  await expect(deviceLockButton).toBeVisible({ timeout: 10_000 });
  await deviceLockButton.click();
  await expect(page.getByText(/non è più fidato/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Sblocca con impronta/Face ID" })).not.toBeVisible();
  await expect(page.getByLabel("Master password", { exact: true })).toBeVisible();
});
