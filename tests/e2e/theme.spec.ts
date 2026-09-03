import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

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

  // Persiste a un refresh vero (localStorage, letto dallo script inline prima del primo paint).
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await expect(page.getByRole("radio", { name: "Scuro" })).toHaveAttribute("aria-checked", "true");

  await lightRadio.click();
  await expect(html).not.toHaveClass(/dark/);
  await expect(lightRadio).toHaveAttribute("aria-checked", "true");
});
