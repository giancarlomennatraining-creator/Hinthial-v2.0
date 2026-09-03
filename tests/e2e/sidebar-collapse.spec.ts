import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, fullName, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("il tasto di comprimi/espandi la barra laterale nasconde etichette e nome, cambia il logo, e persiste al refresh", async ({
  page,
}) => {
  const user = uniqueTestUser();
  await createConfirmedTestUser(user);

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  const aside = page.locator("aside");
  const logo = aside.locator("img");
  const name = fullName(user);

  // Stato iniziale: espansa, logo con scritta, nome utente visibile.
  await expect(logo).toHaveAttribute("src", "/brand/logo-lockup.svg");
  await expect(aside).toHaveClass(/w-56/);
  await expect(aside.getByText(name)).toBeVisible();

  // Comprime.
  await page.getByRole("button", { name: "Comprimi il menu" }).click();
  await expect(logo).toHaveAttribute("src", "/brand/logo.svg");
  await expect(aside).toHaveClass(/w-20/);

  // Il nome sparisce dalla vista (resta solo per gli screen reader, v.
  // sr-only in UserMenu --- non un elemento "not visible" secondo
  // Playwright, dato che clip via CSS non azzera il bounding box) ---
  // l'avatar (qui le iniziali) resta visibile.
  await expect(aside.getByText(name)).toHaveClass(/sr-only/);
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  await expect(aside.getByText(initials, { exact: true })).toBeVisible();

  // I link restano cliccabili --- solo l'icona è visibile, l'etichetta
  // resta per gli screen reader (v. MainNav, sr-only), quindi il nome
  // accessibile del link è ancora "Archivio".
  await aside.getByRole("link", { name: "Archivio" }).click();
  await expect(page).toHaveURL(/\/archive$/);

  // Persiste dopo un refresh vero --- solo su questo dispositivo (localStorage), come il tema.
  await page.reload();
  await expect(aside).toHaveClass(/w-20/);
  await expect(page.getByRole("button", { name: "Espandi il menu" })).toBeVisible();

  // Riespande.
  await page.getByRole("button", { name: "Espandi il menu" }).click();
  await expect(aside).toHaveClass(/w-56/);
  await expect(logo).toHaveAttribute("src", "/brand/logo-lockup.svg");
  await expect(aside.getByText(name)).toBeVisible();
});
