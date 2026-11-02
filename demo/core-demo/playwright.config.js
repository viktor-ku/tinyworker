import { defineConfig, devices } from "@playwright/test";

// Firefox is left out because it couldn't launch in the sandbox these tests
// were written in; add { name: "firefox", use: devices["Desktop Firefox"] }
// where it can.
export default defineConfig({
  testDir: "e2e",
  reporter: "list",
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "node e2e/serve.js",
    // serve.js starts the dev server first, so once :5182 answers both are up.
    url: "http://localhost:5182/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
