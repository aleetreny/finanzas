import { defineConfig, devices } from "@playwright/test";

const appBasePath = process.env.PLAYWRIGHT_APP_BASE_PATH ?? "";
const testsGitHubPagesBasePath = Boolean(appBasePath);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 3100",
    url: `http://127.0.0.1:3100${appBasePath}/`,
    timeout: 180_000,
    // En local se reutiliza el servidor levantado a mano; en CI siempre limpio.
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3100/__supabase",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "playwright-publishable-key",
      ...(testsGitHubPagesBasePath
        ? {
            GITHUB_ACTIONS: "true",
            GITHUB_REPOSITORY: "aleetreny/finanzas",
          }
        : {}),
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
