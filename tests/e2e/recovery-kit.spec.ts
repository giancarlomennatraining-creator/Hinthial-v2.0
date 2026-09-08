import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("la schermata di salvataggio della recovery key offre un kit stampabile con QR, oltre a copia e download", async ({
  page,
}) => {
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

  const recoveryKeyText = await page.locator("code").first().innerText();
  expect(recoveryKeyText.trim().length).toBeGreaterThan(0);

  // Il kit stampabile esiste già nel DOM (invisibile a schermo, v.
  // globals.css --- diventa visibile solo nella finestra di stampa) e
  // contiene la stessa chiave, più un QR generato dal client.
  const printableKit = page.locator(".print-only");
  await expect(printableKit).toHaveCount(1);
  await expect(printableKit).not.toBeVisible();
  await expect(printableKit.getByText(recoveryKeyText, { exact: true })).toHaveCount(1);
  const qrImage = printableKit.getByAltText("QR della recovery key");
  await expect(qrImage).toHaveCount(1, { timeout: 10_000 });
  const qrSrc = await qrImage.getAttribute("src");
  expect(qrSrc).toMatch(/^data:image\//);

  // Il pulsante di stampa non blocca né rompe la pagina --- in
  // headless non c'è un vero dialogo di stampa da attendere.
  await page.getByRole("button", { name: "🖨️ Stampa kit di recovery" }).click();
  await expect(
    page.getByLabel("Ho salvato la recovery key in un posto sicuro."),
  ).toBeVisible();
});
