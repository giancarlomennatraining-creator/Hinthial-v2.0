import { expect, test } from "./fixtures";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

/**
 * FASE 22/22b/24 --- preferenze di consenso impostabili già oggi per
 * funzioni non ancora costruite (estrazione avanzata dei contenuti,
 * trascrizione, avvisi proattivi): nessuna ha un effetto reale, ma la
 * cascata di dipendenze (masterEnabled -> tutto; extractionConsent ->
 * healthConsent + proactiveAlertsConsent) deve comportarsi bene fin da
 * ora, prima che ci sia una vera funzione dietro a verificarla altrove.
 */
test("le preferenze per estrazione avanzata, Salute, trascrizione e avvisi proattivi si spengono a cascata e sopravvivono a un refresh", async ({
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

  await page.getByRole("button", { name: fullName(user) }).click();
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("tab", { name: "Intelligenza artificiale" }).click();
  await expect(page.getByRole("heading", { name: "Intelligenza artificiale" })).toBeVisible();

  const masterSwitch = page.getByRole("switch", { name: "Consenti l'uso di IA esterna" });
  const extractionCheckbox = page.getByRole("checkbox", { name: /^Estrazione avanzata/ });
  const healthCheckbox = page.getByRole("checkbox", { name: /Includi anche la categoria Salute/ });
  const transcriptionCheckbox = page.getByRole("checkbox", { name: /^Trascrizione/ });
  const alertsCheckbox = page.getByRole("checkbox", { name: /^Generazione di avvisi proattivi/ });

  // Senza il cancello generale, tutto è disabilitato.
  await expect(extractionCheckbox).toBeDisabled();
  await expect(healthCheckbox).toBeDisabled();
  await expect(transcriptionCheckbox).toBeDisabled();
  await expect(alertsCheckbox).toBeDisabled();

  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    masterSwitch.click(),
  ]);
  await expect(masterSwitch).toHaveAttribute("aria-checked", "true");

  // Accendere il cancello sblocca tutto tranne Salute e Avvisi proattivi,
  // che restano subordinati all'estrazione avanzata.
  await expect(extractionCheckbox).toBeEnabled();
  await expect(transcriptionCheckbox).toBeEnabled();
  await expect(healthCheckbox).toBeDisabled();
  await expect(alertsCheckbox).toBeDisabled();

  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    extractionCheckbox.check(),
  ]);
  await expect(healthCheckbox).toBeEnabled();
  await expect(alertsCheckbox).toBeEnabled();

  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    healthCheckbox.check(),
  ]);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    alertsCheckbox.check(),
  ]);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    transcriptionCheckbox.check(),
  ]);
  await expect(healthCheckbox).toBeChecked();
  await expect(alertsCheckbox).toBeChecked();
  await expect(transcriptionCheckbox).toBeChecked();

  // Spegnere l'estrazione avanzata spegne e disabilita anche Salute e
  // Avvisi proattivi --- ma non la Trascrizione, che è indipendente.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    extractionCheckbox.uncheck(),
  ]);
  await expect(healthCheckbox).not.toBeChecked();
  await expect(healthCheckbox).toBeDisabled();
  await expect(alertsCheckbox).not.toBeChecked();
  await expect(alertsCheckbox).toBeDisabled();
  await expect(transcriptionCheckbox).toBeChecked();

  // Resta impostato dopo un refresh vero.
  await page.reload();
  await page.getByRole("tab", { name: "Intelligenza artificiale" }).click();
  await expect(page.getByRole("heading", { name: "Intelligenza artificiale" })).toBeVisible();
  await expect(extractionCheckbox).not.toBeChecked();
  await expect(transcriptionCheckbox).toBeChecked();
  await expect(healthCheckbox).toBeDisabled();
  await expect(alertsCheckbox).toBeDisabled();

  // Riaccendere l'estrazione avanzata NON riaccende Salute/Avvisi da
  // solo --- restano scelte esplicite a sé, come per il cancello generale.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    extractionCheckbox.check(),
  ]);
  await expect(healthCheckbox).toBeEnabled();
  await expect(healthCheckbox).not.toBeChecked();
  await expect(alertsCheckbox).toBeEnabled();
  await expect(alertsCheckbox).not.toBeChecked();

  // Spegnere il cancello generale spegne e disabilita tutto, trascrizione compresa.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/profiles") && res.request().method() === "PATCH"),
    masterSwitch.click(),
  ]);
  await expect(masterSwitch).toHaveAttribute("aria-checked", "false");
  await expect(extractionCheckbox).not.toBeChecked();
  await expect(extractionCheckbox).toBeDisabled();
  await expect(transcriptionCheckbox).not.toBeChecked();
  await expect(transcriptionCheckbox).toBeDisabled();
});
