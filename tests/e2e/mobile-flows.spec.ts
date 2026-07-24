import { expect, test, type Page } from "@playwright/test";
import { installMockFinanceBackend, signInToMockFinance } from "./mock-finance";

const runtimeErrors = new WeakMap<Page, string[]>();

test.describe("mobile quality flows", () => {
  test.skip(({ isMobile }) => !isMobile, "Auditoría específica de móvil");

  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    runtimeErrors.set(page, errors);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await installMockFinanceBackend(page);
    await signInToMockFinance(page);
  });

  test.afterEach(async ({ page }) => {
    expect(runtimeErrors.get(page) ?? [], "Errores de ejecución o consola").toEqual([]);
  });

  test("all application tabs load, navigate and stay inside the viewport", async ({ page }) => {
    test.setTimeout(90_000);
    const routes = [
      { path: "/dashboard/", heading: "Mis gastos, mes a mes" },
      { path: "/movimientos/", heading: "Apuntes" },
      { path: "/movimientos/nuevo/", heading: "Anotar un gasto" },
      { path: "/piso-malaga/", heading: "Piso Málaga" },
      { path: "/importar-exportar/", heading: "Importar y exportar" },
      { path: "/ajustes/", heading: "Ajustes" },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
      const widths = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(widths.document, `${route.path} desborda horizontalmente`).toBe(widths.viewport);
    }

    const mobileNav = page.getByRole("navigation", { name: "Navegación móvil" });
    for (const item of [
      { name: "Resumen", url: /\/dashboard\/?$/ },
      { name: "Apuntes", url: /\/movimientos\/?$/ },
      { name: "Anotar", url: /\/movimientos\/nuevo\/?$/ },
      { name: "Piso", url: /\/piso-malaga\/?$/ },
      { name: "Ajustes", url: /\/ajustes\/?$/ },
    ]) {
      await mobileNav.getByRole("link", { name: item.name }).click();
      await expect(page).toHaveURL(item.url);
    }
  });

  test("a long new-expense form uses document scroll and remains saveable with a short viewport", async ({ page }) => {
    await page.goto("/movimientos/nuevo/");
    await page.setViewportSize({ width: 412, height: 520 });

    await page.getByLabel("Importe en euros").fill("34,75");
    await page.getByRole("button", { name: "Comida", exact: true }).click();
    await page.getByLabel("Concepto").fill("Compra móvil");
    await page.getByRole("button", { name: "Más detalles" }).click();
    await page.getByLabel("Contexto").fill("Prueba responsive");
    await page.getByLabel("Notas").fill("El botón debe seguir siendo alcanzable con el teclado abierto.");

    const submit = page.getByRole("button", { name: "Anotar", exact: true });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();

    const scrolling = await page.evaluate(() => ({
      bodyOverflow: getComputedStyle(document.body).overflow,
      frameOverflow: getComputedStyle(document.querySelector(".app-frame")!).overflowY,
      scrollY: window.scrollY,
      documentScrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    }));
    expect(scrolling.bodyOverflow).not.toBe("hidden");
    expect(scrolling.frameOverflow).toBe("visible");
    expect(scrolling.documentScrollable).toBe(true);
    expect(scrolling.scrollY).toBeGreaterThan(0);

    await submit.click();
    await expect(page).toHaveURL(/\/movimientos\/?$/);
    await expect(page.locator(".mobile-list").getByText("Compra móvil")).toBeVisible();
  });

  test("compact 320px screens keep dense tabs and touch targets usable", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });

    for (const path of ["/dashboard/", "/piso-malaga/", "/ajustes/"]) {
      await page.goto(path);
      const width = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(width.document, `${path} desborda a 320 px`).toBe(width.viewport);
    }

    await page.goto("/piso-malaga/");
    const actionButtons = page.locator(".property-actions .button");
    await expect(actionButtons).toHaveCount(3);
    for (const button of await actionButtons.all()) {
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator(".mobile-booking-list")).toBeVisible();
  });

  test("movement filters, edit modal and deletion work on mobile", async ({ page }) => {
    await page.goto("/movimientos/");
    await page.getByLabel("Buscar apuntes").fill("Compra semanal");
    await expect(page.getByText("1 apuntes")).toBeVisible();

    const row = page.locator(".mobile-transaction").filter({ hasText: "Compra semanal" });
    await row.getByRole("button", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Concepto").fill("Compra semanal editada");
    await dialog.getByRole("button", { name: "Guardar cambios" }).scrollIntoViewIfNeeded();
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".mobile-list").getByText("Compra semanal editada")).toBeVisible();

    page.once("dialog", (confirmation) => confirmation.accept());
    const editedRow = page.locator(".mobile-transaction").filter({ hasText: "Compra semanal editada" });
    await editedRow.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Compra semanal editada")).toHaveCount(0);
  });

  test("new booking modal scrolls independently and can save at reduced height", async ({ page }) => {
    await page.goto("/piso-malaga/");
    await page.getByRole("button", { name: "Nueva reserva" }).click();
    await page.setViewportSize({ width: 412, height: 520 });

    const dialog = page.getByRole("dialog", { name: "Nueva reserva" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Concepto").fill("Reserva móvil");
    await dialog.getByLabel("Alojamiento final").fill("720");
    await dialog.getByLabel("Limpieza").fill("60");
    await dialog.getByText("Ajustes avanzados").click();
    await dialog.getByLabel("Descuento o ajuste").fill("20");

    const save = dialog.getByRole("button", { name: "Añadir reserva" });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeVisible();
    const modalScroll = await dialog.evaluate((element) => ({
      scrollable: element.scrollHeight > element.clientHeight,
      scrollTop: element.scrollTop,
      maxHeight: getComputedStyle(element).maxHeight,
    }));
    expect(modalScroll.scrollable).toBe(true);
    expect(modalScroll.scrollTop).toBeGreaterThan(0);
    expect(modalScroll.maxHeight).toContain("px");

    await save.click();
    await expect(dialog).toHaveCount(0);
    const bookingCard = page.locator(".mobile-booking").filter({ hasText: "Reserva móvil" });
    await expect(bookingCard).toBeVisible();
    await expect(page.locator(".booking-table-scroll")).toBeHidden();
    await bookingCard.getByRole("button", { name: "Editar" }).click();
    const editDialog = page.getByRole("dialog", { name: "Editar reserva" });
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole("button", { name: "Cerrar Editar reserva" }).click();
    await expect(editDialog).toHaveCount(0);
  });

  test("property expense and recurring-expense dialogs reach their actions", async ({ page }) => {
    await page.goto("/piso-malaga/");
    await page.setViewportSize({ width: 412, height: 520 });

    await page.getByRole("button", { name: "Nuevo gasto", exact: true }).first().click();
    const expenseDialog = page.getByRole("dialog", { name: "Nuevo gasto" });
    await expenseDialog.getByLabel("Importe en euros").fill("95");
    await expenseDialog.getByLabel("Tipo de apunte del piso").selectOption("sub-clean");
    await expenseDialog.getByLabel("Concepto").fill("Limpieza extra");
    const expenseSave = expenseDialog.getByRole("button", { name: "Anotar" });
    await expenseSave.scrollIntoViewIfNeeded();
    await expect(expenseSave).toBeVisible();
    await expenseSave.click();
    await expect(expenseDialog).toHaveCount(0);
    await expect(page.locator(".mobile-list").getByText("Limpieza extra")).toBeVisible();

    await page.getByRole("button", { name: "Gasto periódico", exact: true }).click();
    const recurringDialog = page.getByRole("dialog", { name: "Nuevo gasto periódico" });
    await recurringDialog.getByLabel("Concepto").fill("Seguro anual");
    await recurringDialog.getByLabel("Importe").fill("240");
    await recurringDialog.getByLabel("Periodicidad").selectOption("yearly");
    await recurringDialog.getByLabel("Categoría").selectOption("sub-community");
    const recurringSave = recurringDialog.getByRole("button", { name: "Guardar gasto periódico" });
    await recurringSave.scrollIntoViewIfNeeded();
    await expect(recurringSave).toBeVisible();
    await recurringSave.click();
    await expect(recurringDialog).toHaveCount(0);
    await expect(page.getByText("Seguro anual")).toBeVisible();
  });

  test("settings category flow and CSV import/export are usable on mobile", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/ajustes/");
    await page.getByLabel("Nueva clave").fill("ClaveMovil2026");
    await page.getByLabel("Repite la clave").fill("ClaveMovil2026");
    await page.getByRole("button", { name: "Guardar clave" }).click();
    await expect(page.getByRole("status")).toContainText("Clave guardada");

    await page.getByLabel("Nueva categoría").fill("Salud móvil");
    await page.getByLabel("Se usa para").selectOption("expense");
    await page.locator(".settings-add").getByRole("button", { name: "Añadir" }).click();
    await expect(page.getByText("Salud móvil", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Mostrar subcategorías de Salud móvil" }).click();
    await page.getByLabel("Nueva subcategoría de Salud móvil").fill("Farmacia");
    await page.locator(".settings-category").filter({ hasText: "Salud móvil" }).getByRole("button", { name: "Añadir" }).click();
    await expect(page.getByText("Farmacia", { exact: true })).toBeVisible();

    let category = page.locator(".settings-category").filter({ hasText: "Salud móvil" });
    await category.getByRole("button", { name: "Editar Salud móvil" }).click();
    await page.getByLabel("Nombre de categoría").fill("Salud móvil editada");
    await page.getByRole("button", { name: "Guardar categoría" }).click();
    await expect(page.getByText("Salud móvil editada", { exact: true })).toBeVisible();

    category = page.locator(".settings-category").filter({ hasText: "Salud móvil editada" });
    await category.getByRole("button", { name: "activa", exact: true }).first().click();
    await expect(category.getByRole("button", { name: "inactiva", exact: true }).first()).toBeVisible();
    await category.getByRole("button", { name: "inactiva", exact: true }).first().click();

    let subcategory = category.locator(".settings-subcategory").filter({ hasText: "Farmacia" });
    await subcategory.getByRole("button", { name: "Editar Farmacia" }).click();
    await page.getByLabel("Nombre de subcategoría").fill("Farmacia móvil");
    await page.getByRole("button", { name: "Guardar subcategoría" }).click();
    subcategory = category.locator(".settings-subcategory").filter({ hasText: "Farmacia móvil" });
    await subcategory.getByRole("button", { name: "activa", exact: true }).click();
    await expect(subcategory.getByRole("button", { name: "inactiva", exact: true })).toBeVisible();
    await subcategory.getByRole("button", { name: "inactiva", exact: true }).click();

    page.once("dialog", (confirmation) => confirmation.accept());
    await subcategory.getByRole("button", { name: "Eliminar Farmacia móvil" }).click();
    await expect(page.getByText("Farmacia móvil", { exact: true })).toHaveCount(0);

    page.once("dialog", (confirmation) => confirmation.accept());
    await category.getByRole("button", { name: "Eliminar Salud móvil editada" }).click();
    await expect(page.getByText("Salud móvil editada", { exact: true })).toHaveCount(0);

    await page.goto("/importar-exportar/");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar todos los datos" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^finanzas-\d{4}-\d{2}-\d{2}\.csv$/);

    await page.locator('input[type="file"]').setInputFiles({
      name: "movil.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "\uFEFFfecha;nombre;importe_eur;categoria_principal;subcategoria\n2026-07-22;Farmacia móvil;-18.50;Casa;Suministros\n",
      ),
    });
    await expect(page.getByText("1 filas detectadas")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar importación" }).click();
    await expect(page.getByText(/Importación terminada: 1 filas nuevas/)).toBeVisible();
  });
});
