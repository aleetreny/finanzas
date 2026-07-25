import { expect, test } from "@playwright/test";
import { installMockFinanceBackend, signInToMockFinance } from "./mock-finance";

const basePath = process.env.PLAYWRIGHT_APP_BASE_PATH ?? "";

function appPath(path: string) {
  const route = path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
  return `${basePath}${route}`;
}

test("a saved expense leaves the static form without duplicating the GitHub Pages base path", async ({ page }) => {
  await installMockFinanceBackend(page);
  await signInToMockFinance(page, appPath("/"));
  await page.goto(appPath("/movimientos/nuevo"));

  await page.getByLabel("Importe en euros").fill("18,90");
  await page.getByRole("button", { name: "Comida", exact: true }).click();
  await page.getByLabel("Concepto").fill("Compra sin 404");
  await page.getByRole("button", { name: "Anotar", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`${basePath}/movimientos/$`));
  await expect(page.getByRole("heading", { name: "Apuntes", exact: true })).toBeVisible();
  await expect(page.getByText("This page could not be found.")).toHaveCount(0);
  await expect(page.locator(".mobile-list").getByText("Compra sin 404")).toBeVisible();
});
