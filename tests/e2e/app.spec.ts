import { expect, test } from "@playwright/test";

test("renders the responsive application shell and configuration state", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".brand:visible").first()).toContainText("Finanzas");
  await expect(page.getByRole("heading", { name: "Conecta el proyecto de Supabase" })).toBeVisible();
  await expect(page.getByText("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")).toBeVisible();
});

test("static routes are directly addressable", async ({ page }) => {
  await page.goto("/reservas/");
  await expect(page.getByRole("heading", { name: "Conecta el proyecto de Supabase" })).toBeVisible();
});
