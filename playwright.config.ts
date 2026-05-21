import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Console reporter for the live run, plus a self-contained HTML report and a
  // JUnit XML, both written under reports/ so build.ps1 can extract them.
  reporter: [
    [process.env.CI ? "github" : "list"],
    ["html", { open: "never", outputFolder: "reports/playwright-html" }],
    ["junit", { outputFile: "reports/junit-ui.xml" }],
  ],
  // Traces / failure screenshots land under reports/ too so they travel with
  // the rest of the report when extracted.
  outputDir: "reports/test-results",
  use: {
    baseURL: "http://127.0.0.1:8765",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run serve:ui",
    url: "http://127.0.0.1:8765",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
