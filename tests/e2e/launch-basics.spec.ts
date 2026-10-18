import { expect, test } from "./fixtures";

// Le basi per il lancio: header di sicurezza, pagine legali raggiungibili senza accesso, 404 nello stile di Hinthial,
// e la registrazione che chiede di accettare privacy e termini.

test("ogni pagina arriva con gli header di sicurezza, e la CSP ha un nonce nuovo a ogni richiesta", async ({ request }) => {
  const first = await request.get("/");
  const second = await request.get("/login");
  const headers = first.headers();

  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("microphone=(self)");

  const csp = headers["content-security-policy"];
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  const nonceOf = (value: string) => value.match(/'nonce-([^']+)'/)?.[1];
  expect(nonceOf(csp)).not.toBe(nonceOf(second.headers()["content-security-policy"]));
});

test("privacy e termini si leggono senza accesso, e la pagina iniziale porta a entrambi", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "Informativa privacy" }).click();
  await expect(page.getByRole("heading", { name: "Informativa privacy", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2. Cosa non possiamo vedere" })).toBeVisible();

  // In cima c'è un "indietro" a parole, oltre al logo e al link in fondo.
  await expect(page.getByRole("link", { name: "← Torna alla pagina iniziale" })).toHaveAttribute("href", "/");

  await page.getByRole("link", { name: "Termini d'uso" }).last().click();
  await expect(page.getByRole("heading", { name: "Termini d'uso", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "4. L'Eredità digitale non è un testamento" })).toBeVisible();
});

test("un indirizzo che non esiste mostra la pagina 404 di Hinthial, con la strada per tornare", async ({ page }) => {
  const response = await page.goto("/questa-pagina-non-esiste");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Questa pagina non c'è" })).toBeVisible();
  // Senza accesso non c'è un "Oggi" a cui tornare: il pulsante porta ad Accedi e lo dice.
  await expect(page.getByRole("link", { name: "Accedi", exact: true })).toHaveAttribute("href", "/login");
});

test("la registrazione chiede di accettare privacy e termini, con i link per leggerli", async ({ page }) => {
  await page.goto("/register");
  const consent = page.getByRole("checkbox", { name: /accetto i termini d'uso/ });
  await expect(consent).toBeVisible();
  await expect(consent).not.toBeChecked();
  // Obbligatoria: senza, il modulo non parte.
  expect(await consent.evaluate((el) => (el as HTMLInputElement).required)).toBe(true);
  await expect(page.getByRole("link", { name: "informativa privacy" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("link", { name: "termini d'uso" })).toHaveAttribute("href", "/termini");
});
