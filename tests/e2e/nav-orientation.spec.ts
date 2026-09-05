import { expect, test } from "@playwright/test";
import { createConfirmedTestUser, uniqueTestUser } from "./test-users";

// Requires a configured Supabase project (.env.local) --- see README.md.

test("la disposizione del menu si imposta da Impostazioni > Aspetto, cambia subito il layout, e resta impostata dopo un refresh", async ({
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

  // Default: barra laterale verticale a sinistra, niente barra orizzontale.
  await expect(page.locator("aside")).toBeVisible();
  await expect(page.locator("header")).toHaveCount(0);
  const leftSidebarBox = await page.locator("aside").boundingBox();
  expect(leftSidebarBox).not.toBeNull();
  expect(leftSidebarBox!.x).toBeLessThan(50);

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await expect(page.getByRole("heading", { name: "Disposizione del menu" })).toBeVisible();
  const group = page.getByRole("radiogroup", { name: "Disposizione del menu" });
  await expect(group.getByRole("radio", { name: "Verticale (a sinistra)" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // Orizzontale: la barra laterale sparisce, compare una barra in alto
  // con la stessa navigazione (voci ridotte a sole icone). Il click
  // aggiorna subito lo stato (ottimistico), ma il salvataggio vero è un
  // giro di rete verso Supabase --- si attende la risposta prima di
  // navigare altrove, altrimenti la richiesta rischia di essere
  // interrotta a metà dalla navigazione stessa.
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/profiles") && res.request().method() === "PATCH",
    ),
    group.getByRole("radio", { name: "Orizzontale (in alto)" }).click(),
  ]);
  await expect(group.getByRole("radio", { name: "Orizzontale (in alto)" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.locator("aside")).toHaveCount(0);
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: "HINTHIAL" })).toBeVisible();
  await expect(page.locator("header").getByRole("link", { name: "Dashboard" })).toBeVisible();

  // Resta impostata navigando altrove...
  await page.goto("/dashboard");
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator("aside")).toHaveCount(0);

  // ...e dopo un refresh vero --- sincronizzata sul server, letta prima
  // ancora del primo render della shell (v. getCurrentUser), non solo
  // in localStorage come il tema.
  await page.reload();
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator("aside")).toHaveCount(0);

  // Verticale a destra: la barra torna verticale, ma sul lato opposto.
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Aspetto" }).click();
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/profiles") && res.request().method() === "PATCH",
    ),
    group.getByRole("radio", { name: "Verticale (a destra)" }).click(),
  ]);
  await expect(group.getByRole("radio", { name: "Verticale (a destra)" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.locator("header")).toHaveCount(0);
  await expect(page.locator("aside")).toBeVisible();

  await page.goto("/dashboard");
  const mainBox = await page.locator("main").boundingBox();
  const rightSidebarBox = await page.locator("aside").boundingBox();
  expect(mainBox).not.toBeNull();
  expect(rightSidebarBox).not.toBeNull();
  expect(rightSidebarBox!.x).toBeGreaterThan(mainBox!.x);
});
