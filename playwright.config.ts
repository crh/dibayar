import { defineConfig } from "@playwright/test";

const port = Number(process.env.UX_PORT ?? 3100);
const skipWebServer = process.env.UX_SKIP_WEBSERVER === "1";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/ux-audit",
  outputDir: "test-results/ux-audit",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/ux-audit/results.json" }]],
  use: {
    baseURL,
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
