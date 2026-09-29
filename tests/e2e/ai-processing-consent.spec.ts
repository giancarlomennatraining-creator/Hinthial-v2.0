import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * Due livelli di consenso: un "cancello" generale (ai_master_enabled) e un consenso specifico per la Chat
 * (ai_chat_consent). Un'unica implementazione (AIConsentSettings), riusata sia in Impostazioni sia nel pannello ⚙
 * della pagina AI: lo stesso stato, non due copie da sincronizzare. Non serve una vera ANTHROPIC_API_KEY: con
 * entrambi i consensi attivi ma la chiave non configurata, la route risponde con un errore chiaro.
 */
test("il consenso all'AI reale ha un cancello generale (Impostazioni > Hinthia) e un consenso specifico per la Chat, entrambi necessari", async ({
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

  // Un bene in categoria Assicurazioni, perché il retrieval locale trovi qualcosa di pertinente e la domanda arrivi davvero alla route server-side.
  await page.getByRole("link", { name: "Beni" }).click();
  await page.getByRole("link", { name: "+ Crea bene" }).click();
  await page.getByLabel("Nome").fill("Auto Panda");
  await page.locator("#categoryId").selectOption({ label: "🛡️ Assicurazioni" });
  await page.getByRole("button", { name: "Aggiungi bene" }).click();
  await expect(page).toHaveURL(/\/assets$/, { timeout: 15_000 });

  // Senza il cancello generale, l'interruttore specifico resta visibile ma disabilitato.
  await page.getByRole("link", { name: "Hinthia", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Parla con Hinthia" })).toBeVisible();
  await page.getByRole("button", { name: "Configura Hinthia" }).click();
  const panel = page.getByRole("dialog", { name: "Configura Hinthia" });

  const masterSwitch = panel.getByRole("switch", { name: "Consenti l'uso di Hinthia" });
  const chatCheckbox = panel.getByRole("checkbox", { name: /^Chat/ });
  await expect(masterSwitch).toHaveAttribute("aria-checked", "false");
  await expect(chatCheckbox).toBeDisabled();

  // Accendere il cancello sblocca la funzione specifica, ma non la accende da solo.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    masterSwitch.click(),
  ]);
  await expect(masterSwitch).toHaveAttribute("aria-checked", "true");
  await expect(chatCheckbox).toBeEnabled();
  await expect(chatCheckbox).not.toBeChecked();

  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    chatCheckbox.check(),
  ]);
  await expect(chatCheckbox).toBeChecked();

  await panel.getByRole("button", { name: "Chiudi" }).click();
  await expect(panel).not.toBeVisible();

  // Senza una vera chiave configurata, la domanda arriva comunque alla route server-side, che risponde con un errore chiaro.
  await page.getByLabel("Fai una domanda").fill("Quali assicurazioni ho?");
  await page.getByRole("button", { name: "Invia" }).click();
  await expect(
    page.getByText("Hinthia non è ancora configurata su questo server."),
  ).toBeVisible({ timeout: 15_000 });

  // Stesso stato, visibile e modificabile anche da Impostazioni: non una copia separata, lo stesso componente.
  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Hinthia" }).click();
  await expect(page.getByRole("heading", { name: "Hinthia" })).toBeVisible();
  const settingsMasterSwitch = page.getByRole("switch", { name: "Consenti l'uso di Hinthia" });
  const settingsChatCheckbox = page.getByRole("checkbox", { name: /^Chat/ });
  await expect(settingsMasterSwitch).toHaveAttribute("aria-checked", "true");
  await expect(settingsChatCheckbox).toBeChecked();

  // Spegnere il cancello generale spegne anche la funzione specifica.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    settingsMasterSwitch.click(),
  ]);
  await expect(settingsMasterSwitch).toHaveAttribute("aria-checked", "false");
  await expect(settingsChatCheckbox).not.toBeChecked();
  await expect(settingsChatCheckbox).toBeDisabled();

  // Resta impostato dopo un refresh vero: questa scheda non richiede la Master Key sbloccata.
  await page.reload();
  await page.getByRole("tab", { name: "Hinthia" }).click();
  await expect(page.getByRole("heading", { name: "Hinthia" })).toBeVisible();
  await expect(settingsMasterSwitch).toHaveAttribute("aria-checked", "false");

  // Tornando sulla pagina Hinthia, il pannello mostra lo stesso stato spento.
  await page.getByRole("link", { name: "Hinthia", exact: true }).click();
  await page.getByRole("button", { name: "Configura Hinthia" }).click();
  await expect(masterSwitch).toHaveAttribute("aria-checked", "false");
  await expect(chatCheckbox).toBeDisabled();
});
