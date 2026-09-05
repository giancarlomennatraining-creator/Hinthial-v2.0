import { expect, test } from "@playwright/test";

test("la home page pubblica mostra la barra in alto, il corpo con carosello automatico e le sezioni brochure", async ({
  page,
}) => {
  // Installato prima di navigare: intercetta i timer della pagina, per
  // testare l'avanzamento automatico del carosello senza attese reali.
  await page.clock.install();
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

  // Avanzamento automatico: ogni navigazione manuale fa ripartire
  // l'attesa di 6 secondi da capo --- superata di poco (un solo tick,
  // non più d'uno), si passa alla slide successiva. Il mouse resta però
  // fermo sopra il carosello dopo l'ultimo click: come un utente reale,
  // va allontanato per uscire dalla pausa "al passaggio del mouse".
  await page.mouse.move(0, 0);
  await page.clock.fastForward(6500);
  await expect(
    carousel.getByRole("heading", { name: "I tuoi dati, solo tuoi" }),
  ).toBeVisible();

  // Sezioni in stile brochure, dopo il carosello.
  await expect(page.getByRole("heading", { name: "Perché Hinthial" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Zero-knowledge davvero" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Come funziona" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Crea il tuo account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pronto a mettere ordine?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Inizia subito" })).toBeVisible();
});
