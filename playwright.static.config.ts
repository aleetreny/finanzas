import { defineConfig, devices } from "@playwright/test";

const basePath = "/finanzas";
const port = 3200;
process.env.PLAYWRIGHT_APP_BASE_PATH = basePath;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    // Las llamadas al backend se interceptan con el mock de Playwright. El
    // service worker se valida por separado en tests/service-worker.test.ts.
    serviceWorkers: "block",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node scripts/build-and-serve-pages.mjs",
    url: `http://127.0.0.1:${port}${basePath}/`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "aleetreny/finanzas",
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}/__supabase`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "playwright-publishable-key",
      STATIC_BASE_PATH: basePath,
      STATIC_SERVER_PORT: String(port),
    },
  },
  projects: [
    { name: "static-mobile", use: { ...devices["Pixel 7"] } },
    { name: "static-mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
});
