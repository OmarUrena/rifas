import { defineConfig } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT ?? "3102");
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error("PLAYWRIGHT_PORT no válido.");
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/warm-e2e.mjs",
  workers: 2,
  // Each run starts an isolated cold dev build; navigation compilation is not a product SLA.
  timeout: 60000,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 360, height: 800 } } },
    { name: "tablet", use: { browserName: "chromium", viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 900 } } },
    { name: "firefox-desktop", use: { browserName: "firefox", viewport: { width: 1280, height: 900 } } },
    { name: "webkit-mobile", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `node scripts/start-test-web.mjs ${port}`,
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    env: { API_MODE: "mock", APP_ENV: "test" },
    timeout: 120000,
  },
});
