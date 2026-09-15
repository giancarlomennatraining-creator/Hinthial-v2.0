import { createClient } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.
//
// Il vero scenario è due dispositivi diversi (un PC nuovo, uno
// smartphone già fidato) --- qui simulati con due browser context
// separati (niente cookie/localStorage condivisi, esattamente come due
// dispositivi fisici), entrambi loggati come lo stesso account. Il QR
// vero e proprio non viene "letto" con una fotocamera --- non serve:
// l'unica informazione che contiene è l'URL della richiesta, letta qui
// direttamente dal database con la chiave di servizio (bypassa la RLS,
// come il resto della configurazione di questi test) invece di
// decodificare l'immagine del QR pixel per pixel.

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test("un dispositivo nuovo si sblocca facendosi approvare, via QR, da uno già fidato", async ({
  page,
  browser,
}) => {
  test.slow();

  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  // --- "PC": login, configura la master key la prima volta (sblocco automatico). ---
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

  // Esce e rientra --- una sessione davvero nuova, "locked" da capo
  // (il Master Key vive solo in memoria, mai persistito).
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.getByRole("link", { name: "Archivio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sblocca" })).toBeVisible();

  // Genera il QR --- il "PC" resta in attesa da qui in poi.
  await page.getByRole("button", { name: "Sblocca con un dispositivo fidato" }).click();
  await expect(page.getByText("In attesa di conferma…")).toBeVisible({ timeout: 15_000 });

  // Legge l'URL che il QR codifica direttamente dal database (v.
  // commento in cima) --- niente lettura pixel per pixel dell'immagine.
  const admin = adminClient();
  const { data: authUser } = await admin.auth.admin.listUsers();
  const matchedUser = authUser.users.find((u) => u.email === user.email);
  expect(matchedUser).toBeTruthy();
  const { data: requestRow } = await admin
    .from("device_pairing_requests")
    .select("id")
    .eq("owner_id", matchedUser!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  expect(requestRow).toBeTruthy();

  // --- "Smartphone" già fidato: un browser context a parte, stesso account. ---
  const phoneContext = await browser.newContext();
  const phonePage = await phoneContext.newPage();
  await phonePage.goto("/login");
  await phonePage.getByLabel("Email").fill(user.email);
  await phonePage.getByLabel("Password").fill(user.password);
  await phonePage.getByRole("button", { name: "Accedi" }).click();
  await expect(phonePage).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await phonePage.goto(`/pair/${requestRow!.id}`);
  await expect(phonePage.getByRole("heading", { name: "Autorizzare l'accesso?" })).toBeVisible();
  await phonePage.getByLabel("Master password", { exact: true }).fill("una-master-password-solida");
  await phonePage.getByRole("button", { name: "Autorizza" }).click();
  await expect(phonePage.getByRole("heading", { name: "✓ Accesso autorizzato" })).toBeVisible({
    timeout: 15_000,
  });
  await phoneContext.close();

  // --- Di nuovo il "PC": si sblocca da solo, senza aver mai digitato la password qui. ---
  await expect(page.getByRole("heading", { name: "Archivio" })).toBeVisible({ timeout: 15_000 });
});
