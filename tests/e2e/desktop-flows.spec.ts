import { expect, test, type Page } from "@playwright/test";
import {
  createMockFinanceDatabase,
  installMockFinanceBackend,
  signInToMockFinance,
} from "./mock-finance";

const runtimeErrors = new WeakMap<Page, string[]>();

test.describe("desktop quality flows", () => {
  test.describe.configure({ timeout: 60_000 });
  test.skip(({ isMobile }) => Boolean(isMobile), "Auditoría específica de escritorio");

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

  test("every tab is addressable, selected correctly and contained at desktop widths", async ({ page }) => {
    test.setTimeout(90_000);
    const routes = [
      { path: "/dashboard/", heading: "Tu dinero, en movimiento", nav: "Resumen" },
      { path: "/movimientos/", heading: "Apuntes", nav: "Apuntes" },
      { path: "/movimientos/nuevo/", heading: "Anotar un gasto", nav: "Anotar" },
      { path: "/recurrentes/", heading: "Gastos e ingresos recurrentes", nav: "Recurrentes" },
      { path: "/piso-malaga/", heading: "Piso Málaga", nav: "Piso Málaga" },
      { path: "/importar-exportar/", heading: "Importar y exportar", nav: "Importar" },
      { path: "/ajustes/", heading: "Ajustes", nav: "Ajustes" },
      { path: "/instalar/", heading: "Pon Mis gastos en tu móvil" },
    ];

    for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 900 }]) {
      await page.setViewportSize(size);
      for (const route of routes) {
        await page.goto(route.path);
        await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
        if (route.nav) {
          await expect(page.getByRole("navigation", { name: "Navegación principal" })
            .getByRole("link", { name: route.nav, exact: true })).toHaveAttribute("aria-current", "page");
        }
        const width = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }));
        expect(width.document, `${route.path} desborda a ${size.width}px`).toBe(width.viewport);
      }
    }
    await expect(page.getByRole("navigation", { name: "Navegación móvil" })).toBeHidden();
  });

  test("expense and income creation, filtering, editing and deletion work end to end", async ({ page }) => {
    await page.goto("/movimientos/nuevo/");
    await page.getByLabel("Importe en euros").fill("63,40");
    await page.getByRole("button", { name: "Casa", exact: true }).click();
    await page.getByLabel("Concepto").fill("Factura de agua");
    await page.getByLabel("Otra fecha").fill("2026-07-21");
    await page.getByRole("button", { name: "Anotar", exact: true }).click();
    await expect(page).toHaveURL(/\/movimientos\/?$/);
    await expect(page.locator(".data-table .transaction-name").filter({ hasText: "Factura de agua" })).toBeVisible();

    await page.goto("/movimientos/nuevo/");
    await page.getByRole("button", { name: "Ingreso", exact: true }).click();
    await page.getByLabel("Importe en euros").fill("125");
    await page.getByLabel("Tipo de ingreso").selectOption("sub-salary");
    await page.getByLabel("Concepto").fill("Colaboración");
    await page.getByRole("button", { name: "Anotar", exact: true }).click();
    await expect(page.locator(".data-table .transaction-name").filter({ hasText: "Colaboración" })).toBeVisible();

    await page.getByLabel("Buscar apuntes").fill("Factura de agua");
    await expect(page.getByText("1 apuntes")).toBeVisible();
    const row = page.locator("tbody tr").filter({ hasText: "Factura de agua" });
    await row.getByRole("button", { name: "Editar Factura de agua" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await dialog.getByLabel("Concepto").fill("Factura de agua corregida");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".data-table .transaction-name").filter({ hasText: "Factura de agua corregida" })).toBeVisible();

    await page.locator("tbody tr").filter({ hasText: "Factura de agua corregida" })
      .getByRole("button", { name: "Editar Factura de agua corregida" }).click();
    page.once("dialog", (confirmation) => confirmation.accept());
    await page.getByRole("dialog", { name: "Editar movimiento" })
      .getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Factura de agua corregida", { exact: true })).toHaveCount(0);
  });

  test("recurring expenses and incomes support create, edit, pause, resume and delete", async ({ page }) => {
    await page.goto("/recurrentes/");
    await page.getByRole("button", { name: "Nuevo recurrente" }).click();
    let dialog = page.getByRole("dialog", { name: "Nuevo recurrente" });
    await dialog.getByLabel("Concepto").fill("Internet");
    await dialog.getByLabel("Importe").fill("39.90");
    await dialog.getByLabel("Periodicidad").selectOption("monthly");
    await dialog.getByLabel("Categoría", { exact: true }).selectOption("cat-home");
    await dialog.getByLabel("Subcategoría", { exact: false }).selectOption("sub-home");
    await dialog.getByRole("button", { name: "Crear recurrente" }).click();

    let internet = page.locator(".recurring-rule-card").filter({ hasText: "Internet" });
    await internet.getByRole("button", { name: "Editar" }).click();
    dialog = page.getByRole("dialog", { name: "Editar recurrente" });
    await dialog.getByLabel("Concepto").fill("Fibra e internet");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();

    internet = page.locator(".recurring-rule-card").filter({ hasText: "Fibra e internet" });
    await internet.getByRole("button", { name: "Pausar" }).click();
    await expect(internet.getByText("En pausa")).toBeVisible();
    await internet.getByRole("button", { name: "Reanudar" }).click();
    await expect(internet.getByRole("button", { name: "Pausar" })).toBeVisible();

    await page.getByRole("button", { name: "Nuevo recurrente" }).click();
    dialog = page.getByRole("dialog", { name: "Nuevo recurrente" });
    await dialog.getByRole("button", { name: "Ingreso" }).click();
    await dialog.getByLabel("Concepto").fill("Nómina mensual");
    await dialog.getByLabel("Importe").fill("2500");
    await dialog.getByLabel("Categoría", { exact: true }).selectOption("cat-income");
    await dialog.getByLabel("Subcategoría", { exact: false }).selectOption("sub-salary");
    await dialog.getByRole("button", { name: "Crear recurrente" }).click();
    await expect(page.locator(".recurring-rule-card").filter({ hasText: "Nómina mensual" }).getByText("Ingreso", { exact: true })).toBeVisible();

    page.once("dialog", (confirmation) => confirmation.accept());
    await internet.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Fibra e internet", { exact: true })).toHaveCount(0);
  });

  test("owner-only Malaga booking, manual expense and property recurrence save from desktop", async ({ page }) => {
    await page.goto("/piso-malaga/");
    await page.getByRole("button", { name: "Nueva reserva" }).click();
    let dialog = page.getByRole("dialog", { name: "Nueva reserva" });
    await dialog.getByLabel("Concepto").fill("Reserva escritorio");
    await dialog.getByLabel("Alojamiento final").fill("820");
    await dialog.getByLabel("Limpieza").fill("65");
    await dialog.getByRole("button", { name: "Añadir reserva" }).click();
    await expect(page.locator(".booking-table-scroll").getByText("Reserva escritorio", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Nuevo gasto", exact: true }).first().click();
    dialog = page.getByRole("dialog", { name: "Nuevo gasto" });
    await dialog.getByLabel("Importe en euros").fill("112");
    await dialog.getByLabel("Tipo de apunte del piso").selectOption("sub-clean");
    await dialog.getByLabel("Concepto").fill("Limpieza de salida");
    await dialog.getByRole("button", { name: "Anotar" }).click();
    await expect(page.locator(".property-section").last().getByText("Limpieza de salida", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Gasto periódico", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Nuevo gasto periódico" });
    await dialog.getByLabel("Concepto").fill("Seguro del piso");
    await dialog.getByLabel("Importe").fill("310");
    await dialog.getByLabel("Periodicidad").selectOption("yearly");
    await dialog.getByLabel("Categoría").selectOption("sub-community");
    await dialog.getByRole("button", { name: "Guardar gasto periódico" }).click();
    await expect(page.getByText("Seguro del piso", { exact: true })).toBeVisible();
  });

  test("settings, install tutorial, CSV download and CSV import are functional", async ({ page }) => {
    await page.goto("/ajustes/");
    await page.getByLabel("Nueva clave").fill("ClaveEscritorio2026");
    await page.getByLabel("Repite la clave").fill("ClaveEscritorio2026");
    await page.getByRole("button", { name: "Guardar clave" }).click();
    await expect(page.getByRole("status")).toContainText("Clave guardada");

    await page.getByLabel("Nueva categoría").fill("Mascotas");
    await page.getByLabel("Se usa para").selectOption("expense");
    await page.locator(".settings-add").getByRole("button", { name: "Añadir" }).click();
    await expect(page.getByText("Mascotas", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Ver instrucciones" }).click();
    await expect(page.getByRole("heading", { name: "Pon Mis gastos en tu móvil" })).toBeVisible();
    await expect(page.getByText("Desde Safari")).toBeVisible();
    await expect(page.getByText("Desde Chrome")).toBeVisible();

    await page.goto("/importar-exportar/");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar todos los datos" }).click();
    expect((await downloadPromise).suggestedFilename()).toMatch(/^finanzas-\d{4}-\d{2}-\d{2}\.csv$/);

    await page.locator('input[type="file"]').setInputFiles({
      name: "escritorio.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "\uFEFFfecha;nombre;importe_eur;categoria_principal;subcategoria\n2026-07-22;Compra importada;-18.50;Casa;Suministros\n",
      ),
    });
    await page.getByRole("button", { name: "Confirmar importación" }).click();
    await expect(page.getByRole("status")).toContainText("1 filas nuevas");
  });

  test("keyboard focus is visible, modal traps focus and Escape restores the trigger", async ({ page }) => {
    await page.goto("/movimientos/");
    await expect(page.getByRole("heading", { name: "Apuntes" })).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skipLink).toBeFocused();
    await skipLink.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    const editButton = page.getByRole("button", { name: "Editar Compra semanal" });
    await editButton.focus();
    await editButton.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Editar movimiento" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(editButton).toBeFocused();
  });
});

test.describe("public account and isolation", () => {
  test.describe.configure({ timeout: 60_000 });
  test("any visitor can register a fresh isolated account and read the public install guide", async ({ page }) => {
    const db = createMockFinanceDatabase();
    db.transactions = [];
    db.recurring_rules = [];
    db.rental_bookings = [];
    db.properties = [];
    await installMockFinanceBackend(page, db, { hasMalagaAccess: false });
    await page.goto("/?invite=playwright-invite");
    await page.getByRole("button", { name: "Crear una cuenta nueva" }).click();
    await page.getByLabel("Nombre").fill("Nueva persona");
    await page.getByLabel("Correo electrónico").fill("nueva@example.com");
    await page.getByLabel("Clave", { exact: true }).fill("ClaveNueva2026");
    await page.getByLabel("Repite la clave").fill("distinta-2026");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page.locator(".auth-feedback").getByRole("alert")).toContainText("no coinciden");

    await page.getByLabel("Repite la clave").fill("ClaveNueva2026");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page.getByRole("heading", { name: "Tu historia empieza aquí" })).toBeVisible();
  });

  test("a non-owner cannot see, navigate to or configure Malaga", async ({ page, isMobile }) => {
    const db = createMockFinanceDatabase();
    db.transactions = [];
    db.recurring_rules = [];
    db.rental_bookings = [];
    db.properties = [];
    await installMockFinanceBackend(page, db, { hasMalagaAccess: false });
    await signInToMockFinance(page);

    const primaryNav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(primaryNav.getByRole("link", { name: "Piso Málaga" })).toHaveCount(0);
    if (isMobile) {
      const mobileNav = page.getByRole("navigation", { name: "Navegación móvil" });
      await expect(mobileNav.getByRole("link")).toHaveCount(5);
      await expect(mobileNav.getByRole("link", { name: "Fijos" })).toBeVisible();
      await expect(page.locator(".mobile-owner-tool")).toHaveCount(0);
    }
    await page.goto("/piso-malaga/");
    await expect(page.getByRole("heading", { name: "Sección privada" })).toBeVisible();

    await page.goto("/ajustes/");
    await expect(page.getByLabel("Se usa para").getByRole("option", { name: "Piso Málaga" })).toHaveCount(0);
    await expect(page.getByText("Piso Málaga", { exact: true })).toHaveCount(0);

    await page.goto("/movimientos/");
    await expect(page.getByText("No hay movimientos que coincidan con los filtros.")).toBeVisible();
    await page.goto("/recurrentes/");
    await expect(page.getByText("Todavía no hay recurrentes.")).toBeVisible();
  });
});
