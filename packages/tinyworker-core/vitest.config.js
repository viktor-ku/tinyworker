import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Every test runs in real browsers through Playwright. Firefox is left out
// because it couldn't launch in the sandbox these tests were written in; add
// { browser: "firefox" } where it can.
export default defineConfig({
  // The worker fixtures import zod. Pre-bundle it up front so Vite doesn't
  // find it mid-run and reload the test page.
  optimizeDeps: { include: ["zod"] },
  test: {
    include: ["tests/**/*.spec.js"],
    globalSetup: ["tests/setup/build-dist.js"],
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright(),
      instances: [{ browser: "chromium" }, { browser: "webkit" }],
    },
  },
});
