import { expect, test } from "@playwright/test";
import { installMockFinanceBackend, signInToMockFinance } from "./mock-finance";

const appBasePath = process.env.PLAYWRIGHT_APP_BASE_PATH ?? "";

function appPath(path: string) {
  const route = path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
  return `${appBasePath}${route}`;
}

test.describe("booking decimal input", () => {
  test.skip(({ isMobile }) => !isMobile, "Comprobación específica del teclado decimal móvil");

  test.beforeEach(async ({ page }) => {
    await installMockFinanceBackend(page);
    await signInToMockFinance(page, appPath("/"));
  });

  test("accepts decimal commas and applies the new Booking split-fee profile", async ({ page }) => {
    await page.goto(appPath("/piso-malaga"));
    await page.getByRole("button", { name: "Nueva reserva" }).click();

    const dialog = page.getByRole("dialog", { name: "Nueva reserva" });
    await expect(dialog.getByLabel("Limpieza")).toHaveValue("60");
    await dialog.getByLabel("Concepto").fill("Booking con coma");
    await dialog.getByLabel("Plataforma", { exact: true }).selectOption("booking");
    await expect(dialog.getByLabel("Porcentaje de plataforma")).toHaveValue("15");
    await expect(dialog.getByLabel("Limpieza")).toHaveValue("70");
    await expect(dialog.getByText(/gestora se le asignan 60 €/)).toBeVisible();

    await dialog.getByLabel("Alojamiento final").fill("720,50");
    await dialog.getByLabel("Limpieza").fill("60,25");
    await dialog.getByText("Ajustes avanzados").click();
    await expect(dialog.getByLabel("Descuento o ajuste")).toHaveCount(0);
    await expect(dialog.getByText(/Vacío: se usará el 1,3 %/)).toBeVisible();
    await dialog.getByLabel("Cargo bancario / ajuste de Booking").fill("200");

    await dialog.getByRole("button", { name: "Añadir reserva" }).scrollIntoViewIfNeeded();
    await dialog.getByRole("button", { name: "Añadir reserva" }).click();

    await expect(dialog).toHaveCount(0);
    const booking = page.locator(".mobile-booking").filter({ hasText: "Booking con coma" });
    await expect(booking).toBeVisible();
    await expect(booking.getByText("-200,00 €")).toBeVisible();
  });
});
