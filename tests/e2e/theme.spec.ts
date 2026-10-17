import { expect, test } from "./fixtures";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("lo stile (Foglia, Notte, Luce) si sceglie in Aspetto → Tema, cambia i colori, resta al refresh ed è indipendente da chiaro/scuro", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  const html = page.locator("html");
  // Il predefinito è Foglia: lo script prima del primo paint lo scrive sempre.
  await expect(html).toHaveAttribute("data-stile", "foglia");
  const brand = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim());
  const foglia = await brand();

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await expect(page.getByRole("radio", { name: /Foglia/ })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("radio", { name: /Notte/ }).click();
  await expect(html).toHaveAttribute("data-stile", "notte");
  await expect(page.getByRole("radio", { name: /Notte/ })).toHaveAttribute("aria-checked", "true");
  const notte = await brand();
  expect(notte).not.toBe(foglia);

  // Resta a un refresh vero, e un tema scuro sopra lo stile cambia ancora i colori senza cambiare lo stile.
  await page.reload();
  await expect(html).toHaveAttribute("data-stile", "notte");
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await page.getByRole("radio", { name: "Scuro" }).click();
  await expect(html).toHaveClass(/dark/);
  await expect(html).toHaveAttribute("data-stile", "notte");
  expect(await brand()).not.toBe(notte);

  await page.getByRole("radio", { name: /Luce/ }).click();
  await expect(html).toHaveAttribute("data-stile", "luce");
  await expect(html).toHaveClass(/dark/);

  // Luce non ha riquadri: l'avviso "serve la master password" (un riquadro negli altri stili) resta due linee sottili,
  // senza angoli né sfondo. Passando a Foglia torna un riquadro.
  await page.goto("/legacy");
  const notice = page.locator(".surface-card", { hasText: "serve prima la master password" });
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCSS("border-top-left-radius", "0px");
  await expect(notice).toHaveCSS("border-left-width", "0px");
  await expect(notice).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.evaluate(() => document.documentElement.setAttribute("data-stile", "foglia"));
  await expect(notice).not.toHaveCSS("border-left-width", "0px");

  // Notte è di vetro: lo stesso riquadro sfoca ciò che ha dietro, e lo sfondo della pagina ha i bagliori (un gradiente).
  await page.evaluate(() => document.documentElement.setAttribute("data-stile", "notte"));
  await expect(notice).toHaveCSS("backdrop-filter", /blur\(14px\)/);
  await expect(page.locator("html")).toHaveCSS("background-image", /radial-gradient/);
  await page.evaluate(() => document.documentElement.setAttribute("data-stile", "foglia"));
  await expect(notice).toHaveCSS("backdrop-filter", "none");
});

test("il toggle del tema in Impostazioni applica la classe dark e persiste al refresh", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await expect(page.getByRole("heading", { name: "Tema" })).toBeVisible();

  const html = page.locator("html");
  const darkRadio = page.getByRole("radio", { name: "Scuro" });
  const lightRadio = page.getByRole("radio", { name: "Chiaro" });

  await darkRadio.click();
  await expect(html).toHaveClass(/dark/);
  await expect(darkRadio).toHaveAttribute("aria-checked", "true");

  // Nel tema scuro la scritta blu del logo non si legge: al suo posto c'è "Hinthial" in testo chiaro (v. BrandLockup).
  const aside = page.locator("aside");
  await expect(aside.getByText("Hinthial", { exact: true })).toBeVisible();
  await expect(aside.locator('img[src="/brand/logo-lockup.svg"]')).toBeHidden();

  // Persiste a un refresh vero (localStorage, letto dallo script inline prima del primo paint).
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await expect(page.getByRole("radio", { name: "Scuro" })).toHaveAttribute("aria-checked", "true");

  await lightRadio.click();
  await expect(html).not.toHaveClass(/dark/);
  await expect(lightRadio).toHaveAttribute("aria-checked", "true");
  await expect(aside.locator('img[src="/brand/logo-lockup.svg"]')).toBeVisible();
  await expect(aside.getByText("Hinthial", { exact: true })).toBeHidden();
});
