// The Playwright config every demo shares. Each demo's playwright.config.js
// passes in `devices` from its own @playwright/test.

/** The three ways a demo is served: see serve.mjs. */
export function demoTargets(ports) {
  return [
    { name: "dev server", url: `http://localhost:${ports.dev}/` },
    { name: "production build", url: `http://localhost:${ports.production}/` },
    { name: "unminified production build", url: `http://localhost:${ports.unminified}/` },
  ];
}

// Firefox is left out because it couldn't launch in the sandbox these tests
// were written in; add { name: "firefox", use: devices["Desktop Firefox"] }
// where it can.
export function demoPlaywrightConfig({ devices, ports }) {
  return {
    testDir: "e2e",
    reporter: "list",
    projects: [
      { name: "chromium", use: { ...devices["Desktop Chrome"] } },
      { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ],
    webServer: {
      command: "node e2e/serve.js",
      // serve.js starts the dev server last, so once it answers all three
      // are up.
      url: `http://localhost:${ports.dev}/`,
      // Never test a build that some earlier run left serving on these ports.
      reuseExistingServer: false,
      timeout: 120_000,
    },
  };
}
