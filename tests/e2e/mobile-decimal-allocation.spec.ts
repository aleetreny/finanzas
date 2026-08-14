import { expect, test } from "@playwright/test";
import { installMockFinanceBackend, signInToMockFinance } from "./mock-finance";

const appBasePath = process.env.PLAYWRIGHT_APP_BASE_PATH ?? "";

function appPath(path: string) {
  const route = path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
  return `${appBasePath}${route}`;
}

test.describe("mobile decimal inputs and allocation", () => {
  test.skip(({ isMobile }) => !isMobile, "Comprobación específica del teclado decimal móvil");

  test.beforeEach(async ({ page }) => {
    await installMockFinanceBackend(page);
    await signInToMockFinance(page, appPath("/"));
  });

  test("stores an allocation period without changing the bank date", async ({ page }) => {
    await page.goto(appPath("/movimientos/nuevo"));
    await page.getByLabel("Importe en euros").fill("90,00");
    await page.getByRole("button", { name: "Casa", exact: true }).click();
    await page.getByLabel("Concepto").fill("Factura de luz");
    await page.getByLabel("Otra fecha").fill("2026-08-07");
    await page.getByRole("button", { name: /Más detalles/ }).click();
    await page.getByLabel("Imputar desde").fill("2026-06-30");
    await page.getByLabel("Imputar hasta").fill("2026-07-30");
    await page.getByRole("button", { name: "Anotar", exact: true }).click();

    await expect(page).toHaveURL(/\/movimientos\/?$/);
    const movement = page.locator(".mobile-transaction").filter({ hasText: "Factura de luz" });
    await expect(movement).toContainText("7 ago 2026");
    await expect(movement).toContainText("Periodo 30 jun 2026 – 30 jul 2026");

    await movement.getByRole("button", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await expect(dialog.getByLabel("Imputar desde")).toHaveValue("2026-06-30");
    await expect(dialog.getByLabel("Imputar hasta")).toHaveValue("2026-07-30");
  });

  test("accepts decimal commas in general recurring expenses", async ({ page }) => {
    await page.goto(appPath("/recurrentes"));
    await page.getByRole("button", { name: "Nuevo recurrente" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo recurrente" });
    await dialog.getByLabel("Concepto").fill("Internet con coma");
    await dialog.getByLabel("Importe").fill("39,90");
    await dialog.getByLabel("Categoría", { exact: true }).selectOption("cat-home");
    await dialog.getByLabel("Subcategoría", { exact: false }).selectOption("sub-home");
    await dialog.getByRole("button", { name: "Crear recurrente" }).scrollIntoViewIfNeeded();
    await dialog.getByRole("button", { name: "Crear recurrente" }).click();
    await expect(page.locator(".recurring-rule-card").filter({ hasText: "Internet con coma" })).toBeVisible();
  });

  test("accepts decimal commas in property recurring expenses", async ({ page }) => {
    await page.goto(appPath("/piso-malaga"));
    await page.getByRole("button", { name: "Gasto periódico", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo gasto periódico" });
    await dialog.getByLabel("Concepto").fill("Comunidad con coma");
    await dialog.getByLabel("Importe").fill("70,80");
    await dialog.getByLabel("Categoría").selectOption("sub-community");
    await dialog.getByRole("button", { name: "Guardar gasto periódico" }).scrollIntoViewIfNeeded();
    await dialog.getByRole("button", { name: "Guardar gasto periódico" }).click();
    await expect(page.getByText("Comunidad con coma", { exact: true })).toBeVisible();
  });
});
