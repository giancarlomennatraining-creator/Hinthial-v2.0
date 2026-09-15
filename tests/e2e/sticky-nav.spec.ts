import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * La barra di navigazione (laterale sopra md, il tasto ☰ sotto md)
 * seguiva il flusso della pagina invece di restare fissa alla finestra:
 * su qualunque pagina più lunga di una schermata --- praticamente
 * sempre, con dati reali --- il tasto per l'avatar o per il menu finiva
 * fuori vista scorrendo, irraggiungibile senza tornare su (v.
 * segnalazione utente: "il menu non si apre più", poi "lo vedo un layer
 * sotto rispetto al corpo della pagina" --- in realtà semplicemente
 * scorso via, non un problema di sovrapposizione). Due cause insieme:
 * mancava `sticky`/un'altezza fissa sulla barra (Sidebar/TopNav/
 * MobileNavBar), e anche aggiungendolo da solo non sarebbe bastato ---
 * `overflow-x: hidden` duplicato su <html> E <body> (globals.css) fa sì
 * che la regola CSS che accoppia gli assi trasformi anche `overflow-y`
 * in "auto" su entrambi, creando due contenitori di scroll ambigui: un
 * elemento `sticky` finiva ancorato a quello sbagliato (v. commento in
 * globals.css).
 */
test("la barra laterale resta fissa alla finestra scorrendo una pagina lunga, l'avatar sempre raggiungibile", async ({
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

  // Impostazioni è naturalmente più alta di una schermata --- non serve
  // popolare dati apposta.
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Impostazioni" })).toBeVisible();

  const aside = page.locator("aside");
  await expect(aside).toBeVisible();
  const asideBoxBefore = await aside.boundingBox();

  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(200);

  // L'altezza/posizione della barra non cambia scorrendo --- resta
  // ancorata alla finestra, non al flusso della pagina.
  const asideBoxAfter = await aside.boundingBox();
  expect(asideBoxAfter!.y).toBe(asideBoxBefore!.y);
  expect(asideBoxAfter!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));

  // L'avatar, in fondo alla barra, resta visibile e cliccabile senza
  // dover tornare su.
  const userMenuTrigger = aside.locator("button", { hasText: fullName(user) });
  await expect(userMenuTrigger).toBeVisible();
  await userMenuTrigger.click();
  await expect(aside.getByRole("link", { name: "Impostazioni" })).toBeVisible();
});

test.describe("sotto md", () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test("il tasto ☰ resta in cima alla finestra scorrendo una pagina lunga di destinatari", async ({
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

    // Master key configurata subito via "Archivio" (già visibile nella
    // barra in basso di default, v. DEFAULT_BOTTOM_NAV_ITEMS) --- un solo
    // click immediatamente dopo il login, come nel resto della suite:
    // aprire prima il cassetto avrebbe dato tempo al popup "Crea la tua
    // master key" di comparire (v. MasterKeyIntroModal), che l'handler
    // automatico di fixtures.ts avrebbe chiuso da sé con "Più tardi"
    // prima che il click su "Amici" dentro il cassetto potesse arrivare.
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

    // "Amici" non è tra le voci della barra in basso di default: sotto
    // md si raggiunge solo apriendo prima il cassetto col tasto ☰.
    await page.getByRole("button", { name: "Apri il menu" }).click();
    await page.getByRole("dialog", { name: "Menu di navigazione" }).getByRole("link", { name: "Amici" }).click();
    await expect(page.getByRole("heading", { name: "Amici" })).toBeVisible();

    // Sotto sm il tasto normale d'intestazione è nascosto, sostituito
    // dal FAB "+" in sovraimpressione (v. MobileAddFab) --- stessa
    // etichetta accessibile, "Aggiungi amico".
    for (let i = 0; i < 8; i++) {
      await page.getByRole("link", { name: "Aggiungi amico" }).click();
      await expect(page.getByRole("heading", { name: "Nuovo amico" })).toBeVisible();
      await page.getByLabel("Nome visualizzato").fill(`Amico Numero ${i}`);
      await page.getByLabel("Email").fill(`amico-${i}-${Date.now()}@esempio.it`);
      await page.getByLabel("Ruolo").fill("Amico");
      await page.getByRole("button", { name: "Aggiungi amico" }).click();
      await expect(page).toHaveURL(/\/friends$/, { timeout: 15_000 });
    }
    await expect(page.locator("li", { hasText: "Amico Numero 7" })).toBeVisible({ timeout: 10_000 });

    const menuButton = page.getByRole("button", { name: "Apri il menu" });
    const boxBefore = await menuButton.boundingBox();

    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(200);

    const boxAfter = await menuButton.boundingBox();
    expect(boxAfter!.y).toBe(boxBefore!.y);

    await menuButton.click();
    await expect(page.getByRole("dialog", { name: "Menu di navigazione" })).toBeVisible();
  });
});
