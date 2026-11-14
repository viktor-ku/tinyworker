import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The worker fixtures import zod. Pre-bundle it up front so Vite doesn't
  // find it mid-run and reload the test page.
  optimizeDeps: { include: ["zod"] },
  test: {
    globalSetup: ["tests/setup/build-dist.js"],
    projects: [
      {
        extends: true,
        test: {
          name: "browser",
          include: ["tests/**/*.spec.js"],
          exclude: ["tests/plugin/**"],
          // Every library test runs in real browsers through Playwright.
          // Firefox is left out because it couldn't launch in the sandbox
          // these tests were written in; add { browser: "firefox" } where it
          // can.
          browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            provider: playwright(),
            instances: [{ browser: "chromium" }, { browser: "webkit" }],
          },
        },
      },
      {
        extends: true,
        test: {
          // The Vite plugin runs in Node, inside Vite.
          name: "plugin",
          include: ["tests/plugin/**/*.spec.js"],
          environment: "node",
        },
      },
    ],
  },
});
