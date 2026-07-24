import { expect, test } from "@playwright/test";
import { installMockFinanceBackend, signInToMockFinance } from "./mock-finance";

test("renders the responsive application shell and private access state", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".nb-brand:visible").first()).toContainText("Mis gastos");
  await expect(page.getByRole("heading", { name: "Entrar en Mis gastos" })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
});

test("static routes are directly addressable", async ({ page }) => {
  await page.goto("/piso-malaga/");
  await expect(page.getByRole("heading", { name: "Entrar en Mis gastos" })).toBeVisible();
});

test("mobile viewport stays contained and exposes app navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Comprobación específica del viewport móvil");

  await installMockFinanceBackend(page);
  await signInToMockFinance(page);

  const mobileNav = page.getByRole("navigation", { name: "Navegación móvil" });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Anotar" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Ajustes" })).toBeVisible();
  await expect(mobileNav.getByText("Importar")).toHaveCount(0);

  await page.locator(".main-content").evaluate((main) => {
    main.innerHTML = `
      <div class="evo">
        <div class="chart-card">
          <svg class="evo-chart compact" viewBox="0 0 620 470">
            <text class="month-lab" x="0" y="450" text-anchor="middle">enero de 2026</text>
            <text class="month-lab" x="620" y="450" text-anchor="middle">diciembre de 2026</text>
          </svg>
        </div>
        <div class="budget-list">
          <div class="budget-row-container"><div class="budget-row"><div class="budget-top">
            <div class="budget-title-group"><button class="name">Una categoría con un nombre especialmente largo</button></div>
            <span class="note">+123% de lo normal</span>
          </div></div></div>
        </div>
      </div>`;
  });

  const layout = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>(".app-frame");
    const header = document.querySelector<HTMLElement>(".nb-top");
    window.scrollTo(0, 100);
    if (frame) frame.scrollLeft = 100;
    if (header) header.scrollLeft = 100;
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      bodyOverflow: getComputedStyle(document.body).overflow,
      documentOverflowY: getComputedStyle(document.documentElement).overflowY,
      frameOverflowY: frame ? getComputedStyle(frame).overflowY : null,
      frameScrollLeft: frame?.scrollLeft ?? null,
      headerScrollLeft: header?.scrollLeft ?? null,
    };
  });

  expect(layout.documentWidth).toBe(layout.viewportWidth);
  expect(layout.bodyOverflow).not.toBe("hidden");
  expect(layout.documentOverflowY).toBe("auto");
  expect(layout.frameOverflowY).toBe("visible");
  expect(layout.frameScrollLeft).toBe(0);
  expect(layout.headerScrollLeft).toBe(0);
});

test("web app manifest exposes install icons and the quick-entry shortcut", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192", type: "image/png" }),
    expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
  ]));
  expect(manifest.shortcuts).toEqual(expect.arrayContaining([
    expect.objectContaining({ url: "/movimientos/nuevo/" }),
  ]));
});
