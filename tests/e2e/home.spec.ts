import { expect, test } from "@playwright/test";

test("la home page pubblica mostra la barra in alto (logo + accedi/registrati) e il corpo con carosello", async ({
  page,
}) => {
  await page.goto("/");

  // Barra in alto: logo a sinistra, Accedi/Registrati a destra (nessun utente autenticato).
  await expect(page.getByRole("link", { name: "HINTHIAL" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Accedi" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Registrati" })).toBeVisible();

  // Corpo: titolo, sottotitolo, CTA, e il carosello di presentazione.
  await expect(
    page.getByRole("heading", { name: "La tua vita digitale, in ordine e al sicuro" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Crea account" })).toBeVisible();

  const carousel = page.getByRole("region", { name: "Cosa puoi fare con Hinthial" });
  await expect(carousel).toBeVisible();
  await expect(carousel.getByRole("heading", { name: "I tuoi dati, solo tuoi" })).toBeVisible();

  // Navigazione manuale: "Slide successiva" porta alla slide 2.
  await carousel.getByRole("button", { name: "Slide successiva" }).click();
  await expect(carousel.getByRole("heading", { name: "Un archivio per tutto" })).toBeVisible();

  // I pallini portano direttamente a una slide specifica.
  await carousel.getByRole("button", { name: "Vai alla slide 5: Un assistente che resta sul tuo dispositivo" }).click();
  await expect(
    carousel.getByRole("heading", { name: "Un assistente che resta sul tuo dispositivo" }),
  ).toBeVisible();
});
