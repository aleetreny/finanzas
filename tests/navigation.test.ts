import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouteHref, navigateToAppRoute } from "@/lib/navigation";

const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

afterEach(() => {
  if (originalBasePath === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
  vi.unstubAllGlobals();
});

describe("static app navigation", () => {
  it("builds GitHub Pages URLs with the base path and trailing slash", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/finanzas";

    expect(appRouteHref("/movimientos")).toBe("/finanzas/movimientos/");
    expect(appRouteHref("/movimientos?month=2026-07")).toBe("/finanzas/movimientos/?month=2026-07");
  });

  it("replaces the saved form with the static destination", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/finanzas";
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });

    navigateToAppRoute("/movimientos");

    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/finanzas/movimientos/");
  });
});
