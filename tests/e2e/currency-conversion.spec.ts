import { expect, test } from "@playwright/test";
import { installMockFinanceBackend, signInToMockFinance } from "./mock-finance";

const appBasePath = process.env.PLAYWRIGHT_APP_BASE_PATH ?? "";
const rate = { date: "2026-09-25", base: "GBP", quote: "EUR", rate: 1.1622 };

test("converts decimal pounds, stores only euros and edits the saved euro amount", async ({ page }, testInfo) => {
  const db = await installMockFinanceBackend(page);
  await page.route("https://api.frankfurter.dev/**", (route) => route.fulfill({ json: rate }));
  await signInToMockFinance(page, `${appBasePath}/`);
  await page.goto(`${appBasePath}/movimientos/nuevo/`);
  await page.getByLabel("Otra fecha").fill("2026-09-27");
  await page.getByRole("button", { name: "£ Libras" }).click();
  await page.getByLabel("Importe en libras").fill("12,34");
  await expect(page.getByRole("status")).toContainText("Se guardarán 14,34");
  await expect(page.getByRole("status")).toContainText("25 sept 2026");
  await page.getByRole("button", { name: "Comida", exact: true }).click();
  await page.getByLabel("Concepto").fill("Compra en Londres");
  await page.getByRole("button", { name: /Más detalles/ }).click();
  await page.getByLabel("Notas").fill("Nota original");
  await page.screenshot({ path: testInfo.outputPath("conversion.png"), fullPage: true });
  await page.getByRole("button", { name: "Anotar", exact: true }).click();
  await expect(page).toHaveURL(/\/movimientos\/?$/);
  const saved = db.transactions.find((row) => row.name === "Compra en Londres");
  expect(saved?.amount).toBe(-14.34);
  expect(saved?.notes).toBe("Nota original");
  expect(saved?.import_metadata).toBeUndefined();

  const movement = page.locator(testInfo.project.use.isMobile ? ".mobile-transaction" : "tbody tr").filter({ hasText: "Compra en Londres" });
  await movement.getByRole("button", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
  await expect(dialog.getByLabel("Importe en euros")).toHaveValue("14,34");
  await dialog.getByLabel("Concepto").fill("Compra editada");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).not.toBeVisible();
  expect(db.transactions.find((row) => row.name === "Compra editada")?.amount).toBe(-14.34);
});

test("blocks pounds while loading or unavailable, retries and allows euros offline", async ({ page }) => {
  const db = await installMockFinanceBackend(page);
  let fail = true;
  await page.route("https://api.frankfurter.dev/**", async (route) => {
    if (fail) await route.fulfill({ status: 503, body: "Unavailable" });
    else await route.fulfill({ json: rate });
  });
  await signInToMockFinance(page, `${appBasePath}/`);
  await page.goto(`${appBasePath}/movimientos/nuevo/`);
  await page.getByRole("button", { name: "£ Libras" }).click();
  await page.getByLabel("Importe en libras").fill("10");
  await expect(page.getByRole("status")).toContainText("No se pudo consultar el cambio");
  await expect(page.getByRole("button", { name: "Anotar", exact: true })).toBeDisabled();
  fail = false;
  await page.getByRole("button", { name: "Reintentar cambio" }).click();
  await expect(page.getByRole("status")).toContainText("Se guardarán 11,62");

  fail = true;
  await page.getByLabel("Otra fecha").fill("2026-09-26");
  await expect(page.getByRole("status")).toContainText("No se pudo consultar el cambio");
  await page.getByRole("button", { name: "€ Euros" }).click();
  await page.getByLabel("Importe en euros").fill("8,50");
  await page.getByRole("button", { name: "Casa", exact: true }).click();
  await page.getByLabel("Concepto").fill("Gasto en euros");
  await page.getByRole("button", { name: "Anotar", exact: true }).click();
  await expect(page).toHaveURL(/\/movimientos\/?$/);
  expect(db.transactions.find((row) => row.name === "Gasto en euros")?.amount).toBe(-8.5);
});

test("uses the expense date, blocks stale rates and rejects future dates", async ({ page }) => {
  const db = await installMockFinanceBackend(page);
  let releaseRate: (() => void) | undefined;
  await page.route("https://api.frankfurter.dev/**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date");
    if (date === "2026-09-24") await new Promise<void>((resolve) => { releaseRate = resolve; });
    if (date === "2026-09-26") await route.fulfill({ json: rate });
    else await route.fulfill({ json: { ...rate, date: "2026-09-24", rate: 1.2 } });
  });
  await signInToMockFinance(page, `${appBasePath}/`);
  await page.goto(`${appBasePath}/movimientos/nuevo/`);
  await page.getByLabel("Otra fecha").fill("2026-09-26");
  await page.getByRole("button", { name: "£ Libras" }).click();
  await page.getByLabel("Importe en libras").fill("10");
  await expect(page.getByRole("status")).toContainText("Se guardarán 11,62");
  await page.getByLabel("Otra fecha").fill("2099-01-01");
  await expect(page.getByRole("status")).toContainText("Elige hoy o una fecha anterior");
  await expect(page.getByRole("button", { name: "Anotar", exact: true })).toBeDisabled();
  await page.getByLabel("Otra fecha").fill("2026-09-24");
  await expect(page.getByRole("status")).toContainText("Consultando el cambio");
  await expect(page.getByRole("button", { name: "Anotar", exact: true })).toBeDisabled();
  await expect.poll(() => Boolean(releaseRate)).toBe(true);
  releaseRate!();
  await expect(page.getByRole("status")).toContainText("Se guardarán 12,00");
  await page.getByRole("button", { name: "Casa", exact: true }).click();
  await page.getByLabel("Concepto").fill("Compra anterior");
  await page.getByRole("button", { name: "Anotar", exact: true }).click();
  await expect(page).toHaveURL(/\/movimientos\/?$/);
  expect(db.transactions.find((row) => row.name === "Compra anterior")?.amount).toBe(-12);
});

test("checks duplicates in euros and confirms without converting twice", async ({ page }) => {
  const db = await installMockFinanceBackend(page);
  await page.route("https://api.frankfurter.dev/**", (route) => route.fulfill({ json: { ...rate, rate: 1.25 } }));
  await signInToMockFinance(page, `${appBasePath}/`);
  await page.goto(`${appBasePath}/movimientos/nuevo/`);
  await page.getByRole("button", { name: "£ Libras" }).click();
  await page.getByLabel("Importe en libras").fill("34");
  await expect(page.getByRole("status")).toContainText("Se guardarán 42,50");
  await page.getByRole("button", { name: "Comida", exact: true }).click();
  await page.getByLabel("Concepto").fill("Posible compra duplicada");
  await page.getByRole("button", { name: "Anotar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Compra semanal");
  await dialog.getByRole("button", { name: /anotarlo igualmente/ }).click();
  await expect(page).toHaveURL(/\/movimientos\/?$/);
  expect(db.transactions.find((row) => row.name === "Posible compra duplicada")?.amount).toBe(-42.5);
});
