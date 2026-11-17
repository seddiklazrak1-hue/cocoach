import { expect, test } from "@playwright/test";

// Parcours sans compte : ce qu'un visiteur voit, et ce qui doit rester fermé.

test("la page d'accueil présente l'app et son avertissement médical", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/pas un dispositif médical/i).first()).toBeVisible();
});

test("la page de connexion affiche le formulaire", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Connexion coach" })).toBeVisible();
  await expect(page.getByLabel(/e-mail/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
});

test("une page du coach renvoie vers la connexion sans session", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("les groupes et athlètes sont fermés sans session", async ({ page }) => {
  for (const path of ["/groups", "/athletes", "/sessions"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});
