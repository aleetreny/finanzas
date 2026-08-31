import { expect, test, type Page } from "@playwright/test";
import { installMockFinanceBackend, signInToMockFinance } from "./mock-finance";

const runtimeErrors = new WeakMap<Page, string[]>();
const appBasePath = process.env.PLAYWRIGHT_APP_BASE_PATH ?? "";

function appPath(path: string) {
  const route = path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
  return `${appBasePath}${route}`;
}

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
    await signInToMockFinance(page, appPath("/"));
  });

  test.afterEach(async ({ page }) => {
    expect(runtimeErrors.get(page) ?? [], "Errores de ejecución o consola").toEqual([]);
  });

  test("all application tabs load, navigate and stay inside the viewport", async ({ page }) => {
    test.setTimeout(90_000);
    const routes = [
      { path: appPath("/dashboard"), heading: /A día \d+ de .+ llevas\.\.\./ },
      { path: appPath("/movimientos"), heading: "Apuntes" },
      { path: appPath("/movimientos/nuevo"), heading: "Anotar un gasto" },
      { path: appPath("/recurrentes"), heading: "Gastos e ingresos recurrentes" },
      { path: appPath("/viajes"), heading: "Viajes" },
      { path: appPath("/piso-malaga"), heading: "Piso Málaga" },
      { path: appPath("/importar-exportar"), heading: "Importar y exportar" },
      { path: appPath("/ajustes"), heading: "Ajustes" },
      { path: appPath("/instalar"), heading: "Pon Mis gastos en tu móvil" },
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
    await expect(mobileNav.getByRole("link")).toHaveCount(5);
    await expect(mobileNav.getByRole("link", { name: "Fijos" })).toHaveCount(0);
    await expect(mobileNav.getByRole("link", { name: "Viajes" })).toHaveCount(0);
    for (const item of [
      { name: "Resumen", url: /\/dashboard\/?$/ },
      { name: "Apuntes", url: /\/movimientos\/?$/ },
      { name: "Piso", url: /\/piso-malaga\/?$/ },
      { name: "Ajustes", url: /\/ajustes\/?$/ },
    ]) {
      await mobileNav.getByRole("link", { name: item.name }).click();
      await expect(page).toHaveURL(item.url);
    }
    const ownerRecurring = page.locator(".mobile-owner-tool").filter({ hasText: "Fijos" });
    await expect(ownerRecurring).toHaveAccessibleName("Recurrentes");
    await ownerRecurring.click();
    await expect(page).toHaveURL(/\/recurrentes\/?$/);
    const ownerTrips = page.locator(".mobile-owner-tool").filter({ hasText: "Viajes" });
    await expect(ownerTrips).toHaveAccessibleName("Viajes");
    await ownerTrips.click();
    await expect(page).toHaveURL(/\/viajes\/?$/);

    await mobileNav.getByRole("link", { name: "Anotar" }).click();
    await expect(page).toHaveURL(/\/movimientos\/nuevo\/?$/);
    await expect(mobileNav).toHaveCount(0);

    await page.goto(appPath("/dashboard"));
    await expect(page.locator(".c7-card").filter({ hasText: "Ingresos" }).locator(".c7-val")).toHaveText("+2400,00 €");
    const incomeToggle = page.getByRole("button", { name: /Ingresos totales/ });
    await incomeToggle.click();
    await expect(incomeToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".evo-chart .income-series")).toHaveCount(1);
    await expect(page.locator(".hover-series-item.income .series-name")).toHaveText("Ingresos:");
    await expect(page.locator(".hover-series-item.income .series-amount")).toHaveText("+2400,00 €");
    await expect(page.locator(".budget-list")).not.toContainText("Ingresos");
  });

  test("owner navigation never flashes the public Viajes slot while access restores", async ({ page }) => {
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("finanzas:malaga-access:")) localStorage.removeItem(key);
      }
    });
    await page.addInitScript(() => {
      sessionStorage.setItem("owner-nav-flashed", "false");
      const inspect = () => {
        const labels = [...document.querySelectorAll(".mobile-nav .mobile-nav-link span")]
          .map((element) => element.textContent?.trim());
        if (labels.includes("Viajes")) sessionStorage.setItem("owner-nav-flashed", "true");
      };
      const observer = new MutationObserver(inspect);
      const start = () => {
        observer.observe(document.documentElement, { childList: true, subtree: true });
        inspect();
      };
      if (document.documentElement) start();
      else document.addEventListener("DOMContentLoaded", start, { once: true });
    });

    await page.goto(appPath("/movimientos"));
    const mobileNav = page.getByRole("navigation", { name: "Navegación móvil" });
    await expect(mobileNav.getByRole("link", { name: "Piso" })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Viajes" })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("owner-nav-flashed")))
      .toBe("false");
  });

  test("new-expense entry has no fixed chrome or horizontal overlap at mobile sizes", async ({ page }) => {
    for (const size of [
      { width: 320, height: 480 },
      { width: 390, height: 520 },
      { width: 430, height: 600 },
    ]) {
      await page.setViewportSize(size);
      await page.goto(appPath("/movimientos/nuevo"));

      await expect(page.getByRole("heading", { name: "Anotar un gasto", exact: true })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Navegación móvil" })).toHaveCount(0);

      const layout = await page.evaluate(() => {
        const selectors = [".page-header", ".seg", ".amount-hero", ".chip-grid", ".q-date", ".trip-picker", ".q-save"];
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          shellHeaderPosition: getComputedStyle(document.querySelector(".nb-top")!).position,
          savePosition: getComputedStyle(document.querySelector(".q-save")!).position,
          outsideViewport: selectors.flatMap((selector) =>
            [...document.querySelectorAll(selector)]
              .filter((element) => {
                const rect = element.getBoundingClientRect();
                return rect.left < -0.5 || rect.right > document.documentElement.clientWidth + 0.5;
              })
              .map(() => selector),
          ),
        };
      });

      expect(layout.documentWidth, `${size.width}px no debe desbordar`).toBe(layout.viewportWidth);
      expect(layout.shellHeaderPosition).not.toMatch(/fixed|sticky/);
      expect(layout.savePosition).toBe("static");
      expect(layout.outsideViewport).toEqual([]);
    }
  });

  test("a long new-expense form uses document scroll and remains saveable with a short viewport", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 520 });
    await page.goto(appPath("/movimientos/nuevo"));

    await expect(page.getByRole("navigation", { name: "Navegación móvil" })).toHaveCount(0);

    const amount = page.getByLabel("Importe en euros");
    await amount.fill("34,75");
    await expect(amount).toBeFocused();
    const foodCategory = page.getByRole("button", { name: "Comida", exact: true });
    await foodCategory.click();
    await expect(foodCategory).toHaveClass(/active/);
    await expect(amount).not.toBeFocused();

    const concept = page.getByLabel("Concepto");
    await concept.fill("Compra móvil");
    await expect(concept).toBeFocused();
    await page.getByText("Fecha", { exact: true }).click();
    await expect(concept).not.toBeFocused();

    await page.getByLabel("Asignar a").selectOption({ label: "Eclipse" });
    await page.getByRole("button", { name: "Más detalles" }).click();
    const notes = page.getByLabel("Notas");
    await notes.fill("El botón debe seguir siendo alcanzable con el teclado abierto.");
    await expect(notes).toBeFocused();

    const focusedLayout = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      const activeRect = active.getBoundingClientRect();
      const overlaps = [...document.querySelectorAll("body *")]
        .filter((element) => {
          if (element === active || element.contains(active)) return false;
          const style = getComputedStyle(element);
          if (style.position !== "fixed" && style.position !== "sticky") return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0
            && rect.height > 0
            && rect.left < activeRect.right
            && rect.right > activeRect.left
            && rect.top < activeRect.bottom
            && rect.bottom > activeRect.top;
        })
        .map((element) => element.className || element.tagName);
      return {
        activeTop: activeRect.top,
        activeBottom: activeRect.bottom,
        viewportHeight: window.visualViewport?.height ?? window.innerHeight,
        overlaps,
      };
    });
    expect(focusedLayout).not.toBeNull();
    expect(focusedLayout!.activeTop).toBeGreaterThanOrEqual(0);
    expect(focusedLayout!.activeBottom).toBeLessThanOrEqual(focusedLayout!.viewportHeight);
    expect(focusedLayout!.overlaps).toEqual([]);

    await page.locator(".quick-form").dispatchEvent("touchmove");
    await expect(notes).not.toBeFocused();

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

  test("a repeated expense warns before saving and the warning fits the phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await page.goto(appPath("/movimientos/nuevo"));
    await page.getByLabel("Importe en euros").fill("42,50");
    await page.getByRole("button", { name: "Comida", exact: true }).click();
    await page.getByRole("button", { name: "Supermercado", exact: true }).click();
    await page.getByLabel("Concepto").fill("Compra semanal otra vez");
    await page.getByRole("button", { name: "Anotar", exact: true }).click();

    const warning = page.getByRole("dialog", { name: "¿Seguro que quieres anotarlo?" });
    await expect(warning).toBeVisible();
    await expect(warning.locator(".duplicate-lead")).toContainText("«Compra semanal»");
    await expect(warning.locator(".duplicate-entry.existing")).toContainText("-42,50 €");
    await expect(warning.locator(".duplicate-entry.existing")).toContainText("Comida · Supermercado");
    await expect(warning.locator(".duplicate-entry.pending")).toContainText("Compra semanal otra vez");

    // El aviso se lee entero en pantalla: sin desbordes ni botones diminutos.
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 640 }, { width: 430, height: 720 }]) {
      await page.setViewportSize(size);
      const layout = await page.evaluate(() => {
        const card = document.querySelector(".duplicate-modal")!;
        const cardRect = card.getBoundingClientRect();
        return {
          document: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
          cardLeft: cardRect.left,
          cardRight: cardRect.right,
          cardTop: cardRect.top,
          cardBottom: cardRect.bottom,
          viewportHeight: window.innerHeight,
          overflowing: [...card.querySelectorAll("*")]
            .filter((element) => element.getBoundingClientRect().right > cardRect.right + 0.5)
            .map((element) => `${element.tagName}.${typeof element.className === "string" ? element.className : ""}`),
        };
      });
      expect(layout.document, `${size.width}px desborda`).toBe(layout.viewport);
      expect(layout.cardLeft).toBeGreaterThanOrEqual(-0.5);
      expect(layout.cardRight).toBeLessThanOrEqual(layout.viewport + 0.5);
      expect(layout.cardTop).toBeGreaterThanOrEqual(-0.5);
      expect(layout.cardBottom).toBeLessThanOrEqual(layout.viewportHeight + 0.5);
      expect(layout.overflowing).toEqual([]);
      for (const name of ["No, lo reviso", "Sí, anotarlo igualmente"]) {
        const box = await warning.getByRole("button", { name }).boundingBox();
        expect(box?.height ?? 0, `${name} a ${size.width}px`).toBeGreaterThanOrEqual(44);
      }
    }

    await warning.getByRole("button", { name: "No, lo reviso" }).click();
    await expect(warning).toHaveCount(0);
    await expect(page).toHaveURL(/\/movimientos\/nuevo\/?$/);
    await expect(page.getByLabel("Concepto")).toHaveValue("Compra semanal otra vez");

    await page.getByRole("button", { name: "Anotar", exact: true }).click();
    await page.getByRole("dialog", { name: "¿Seguro que quieres anotarlo?" })
      .getByRole("button", { name: "Sí, anotarlo igualmente" }).click();
    await expect(page).toHaveURL(/\/movimientos\/?$/);
    await expect(page.locator(".mobile-list").getByText("Compra semanal otra vez")).toBeVisible();
  });

  test("trip groups can be created, selected on an expense and reviewed without overflow", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(appPath("/viajes"));
    await expect(page.getByRole("heading", { name: "Eclipse", exact: true })).toBeVisible();
    await expect(page.getByText("42,50 €", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Nuevo viaje" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo viaje" });
    await dialog.getByLabel("Nombre del viaje").fill("Berlín");
    await dialog.getByRole("button", { name: "Guardar viaje" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /Berlín/ })).toBeVisible();

    await page.goto(appPath("/movimientos/nuevo"));
    await expect(page.getByLabel("Importe en euros")).toHaveValue("");
    await page.getByLabel("Importe en euros").fill("25");
    await page.getByRole("button", { name: "Casa", exact: true }).click();
    await page.getByLabel("Concepto").fill("Metro de Berlín");
    await page.getByLabel("Asignar a").selectOption({ label: "Berlín" });
    await page.getByRole("button", { name: "Anotar", exact: true }).click();
    await expect(page).toHaveURL(/\/movimientos\/?$/);
    await expect(page.locator(".mobile-list").getByText("Metro de Berlín", { exact: true })).toBeVisible();

    await page.goto(appPath("/viajes"));
    await page.getByRole("tab", { name: /Berlín/ }).click();
    await expect(page.getByRole("heading", { name: "Berlín", exact: true })).toBeVisible();
    await expect(page.getByText("Coste neto", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /Casa.*1 gasto/ }).click();
    await expect(page.getByText("Metro de Berlín", { exact: true })).toBeVisible();
    await expect(page.getByText("25,00 €", { exact: true }).first()).toBeVisible();
    const width = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(width.document).toBe(width.viewport);

    page.once("dialog", (confirmation) => confirmation.accept());
    await page.getByRole("button", { name: "Borrar" }).click();
    await expect(page.getByRole("tab", { name: /Berlín/ })).toHaveCount(0);
    await page.goto(appPath("/movimientos"));
    await page.getByLabel("Buscar apuntes").fill("Metro de Berlín");
    await expect(page.locator(".mobile-list").getByText("Metro de Berlín", { exact: true })).toBeVisible();
  });

  test("trip expenses can be opened, renamed and deleted from the category breakdown", async ({ page }) => {
    await page.goto(appPath("/viajes"));
    await page.getByRole("button", { name: /Comida.*1 gasto/ }).click();

    await page.getByRole("button", { name: "Editar gasto Compra semanal" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar gasto" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Concepto").fill("Compra semanal editada");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Editar gasto Compra semanal editada" })).toBeVisible();

    page.once("dialog", (confirmation) => confirmation.accept());
    await page.getByRole("button", { name: "Editar gasto Compra semanal editada" }).click();
    await page.getByRole("dialog", { name: "Editar gasto" }).getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("dialog", { name: "Editar gasto" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Editar gasto Compra semanal editada" })).toHaveCount(0);
    await expect(page.getByText("Todavía no hay gastos en este viaje.", { exact: true })).toBeVisible();
  });

  test("compact 320px screens keep dense tabs and touch targets usable", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 320, height: 568 });

    for (const path of [appPath("/dashboard"), appPath("/viajes"), appPath("/piso-malaga"), appPath("/ajustes")]) {
      await page.goto(path);
      const width = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(width.document, `${path} desborda a 320 px`).toBe(width.viewport);
    }

    await page.goto(appPath("/piso-malaga"));
    const actionButtons = page.locator(".property-actions .button");
    await expect(actionButtons).toHaveCount(3);
    for (const button of await actionButtons.all()) {
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator(".mobile-booking-list")).toBeVisible();
  });

  test("movement filters, edit modal and deletion work on mobile", async ({ page }) => {
    await page.goto(appPath("/movimientos"));
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
    await page.goto(appPath("/piso-malaga"));
    await page.getByRole("button", { name: "Nueva reserva" }).click();
    await page.setViewportSize({ width: 412, height: 520 });

    const dialog = page.getByRole("dialog", { name: "Nueva reserva" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Alojamiento final")).toHaveValue("");
    await expect(dialog.getByLabel("Limpieza")).toHaveValue("60");
    await dialog.getByLabel("Concepto").fill("Reserva móvil");
    await dialog.getByLabel("Alojamiento final").fill("720");
    await dialog.getByLabel("Limpieza").fill("60");
    await dialog.getByText("Ajustes avanzados").click();
    await expect(dialog.getByLabel("Descuento o ajuste")).toHaveCount(0);
    await dialog.getByLabel("Notas").fill("Reserva móvil sin descuento editable.");

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
    await page.goto(appPath("/piso-malaga"));
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
    await expect(recurringDialog.getByLabel("Importe")).toHaveValue("");
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

  test("general recurring income and expense forms scroll, save and can be paused", async ({ page }) => {
    await page.goto(appPath("/recurrentes"));
    await page.setViewportSize({ width: 412, height: 520 });

    await page.getByRole("button", { name: "Nuevo recurrente" }).click();
    const expenseDialog = page.getByRole("dialog", { name: "Nuevo recurrente" });
    await expenseDialog.getByLabel("Concepto").fill("Internet");
    await expect(expenseDialog.getByLabel("Importe")).toHaveValue("");
    await expenseDialog.getByLabel("Importe").fill("39.90");
    await expenseDialog.getByLabel("Periodicidad").selectOption("monthly");
    await expenseDialog.getByLabel("Categoría", { exact: true }).selectOption("cat-home");
    await expenseDialog.getByLabel("Subcategoría", { exact: false }).selectOption("sub-home");
    const createExpense = expenseDialog.getByRole("button", { name: "Crear recurrente" });
    await createExpense.scrollIntoViewIfNeeded();
    await expect(createExpense).toBeVisible();
    expect(await expenseDialog.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await createExpense.click();

    const internet = page.locator(".recurring-rule-card").filter({ hasText: "Internet" });
    await expect(internet).toBeVisible();
    await internet.getByRole("button", { name: "Pausar" }).click();
    await expect(internet.getByText("En pausa")).toBeVisible();

    await page.getByRole("button", { name: "Nuevo recurrente" }).click();
    const incomeDialog = page.getByRole("dialog", { name: "Nuevo recurrente" });
    await incomeDialog.getByRole("button", { name: "Ingreso" }).click();
    await incomeDialog.getByLabel("Concepto").fill("Nómina mensual");
    await incomeDialog.getByLabel("Importe").fill("2450");
    await incomeDialog.getByLabel("Categoría", { exact: true }).selectOption("cat-income");
    await incomeDialog.getByLabel("Subcategoría", { exact: false }).selectOption("sub-salary");
    await incomeDialog.getByRole("button", { name: "Crear recurrente" }).scrollIntoViewIfNeeded();
    await incomeDialog.getByRole("button", { name: "Crear recurrente" }).click();
    await expect(page.locator(".recurring-rule-card").filter({ hasText: "Nómina mensual" }).getByText("Ingreso", { exact: true })).toBeVisible();
  });

  test("settings category flow and CSV import/export are usable on mobile", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(appPath("/ajustes"));
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

    await page.goto(appPath("/importar-exportar"));
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
