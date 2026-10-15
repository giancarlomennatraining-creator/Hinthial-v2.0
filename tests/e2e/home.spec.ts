import { expect, test } from "./fixtures";

test("la home page pubblica racconta il seme, la costellazione e il libro con la chiave", async ({ page }) => {
  await page.goto("/");

  // Barra in alto: logo, Accedi/Registrati (nessun utente autenticato).
  const header = page.getByRole("banner");
  await expect(page.getByRole("link", { name: "HINTHIAL" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Accedi" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Registrati" })).toBeVisible();

  // Hero: la tesi e la chiamata a registrarsi.
  await expect(
    page.getByRole("heading", { level: 1, name: "Ciò che sai e ciò che hai, alla persona giusta, al momento giusto." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Crea il tuo spazio" })).toHaveAttribute("href", "/register");

  // Il seme: un passo per pilastro, che si accende scorrendo.
  await expect(page.getByRole("heading", { name: "Dal seme alle persone che ami" })).toBeVisible();
  const lastStep = page.getByRole("heading", { name: "Al momento giusto, arriva" });
  await lastStep.scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Si comincia da un seme" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Scegli per chi" })).toBeAttached();

  // La costellazione: le capsule si aprono con gli anni, quelle d'eredità solo con l'Eredità digitale.
  const roster = page.getByRole("list", { name: "Persone e capsule" });
  const giulia = roster.getByRole("listitem").filter({ hasText: "Giulia" });
  const paolo = roster.getByRole("listitem").filter({ hasText: "Paolo" });
  await roster.scrollIntoViewIfNeeded();
  await expect(giulia).toContainText("Si apre nel 2031");
  await expect(paolo).toContainText("Solo se non rispondi più");

  await page.getByLabel("Fai scorrere gli anni").fill("2031");
  await expect(page.getByTestId("constellation-year")).toHaveText("2031");
  await expect(giulia).toContainText("Aperta nel 2031");
  await expect(paolo).toContainText("Solo se non rispondi più");

  await page.getByRole("button", { name: "Se un giorno non rispondo più" }).click();
  await expect(paolo).toContainText("Consegnata dall'Eredità digitale");

  // Il libro: da tastiera si apre subito, si legge, e "Come lo vediamo noi" lo rende illeggibile.
  const hold = page.getByRole("button", { name: "Tieni premuto per aprire" });
  await hold.scrollIntoViewIfNeeded();
  await hold.focus();
  await page.keyboard.press("Enter");
  const book = page.getByTestId("key-book");
  await expect(book).toHaveClass(/open/);
  await expect(book).toContainText("Dove sei nato e com'era il posto in cui sei cresciuto?");

  await page.getByRole("button", { name: "Pagina dopo →" }).click();
  await expect(book).toContainText("Il giorno del tuo matrimonio");

  await page.getByRole("button", { name: "Come lo vediamo noi" }).click();
  await expect(book).toContainText("Contenuto cifrato, illeggibile senza la chiave.");
  await expect(book).not.toContainText("Il giorno del tuo matrimonio");

  await page.getByRole("button", { name: "Chiudi il libro" }).click();
  await expect(book).toHaveClass(/closed/);

  // Chiusura: invito finale.
  await expect(page.getByRole("heading", { name: "Il primo seme è già nella tua testa." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Inizia adesso" })).toBeVisible();
});
