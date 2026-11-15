// Started by Playwright (see playwright.config.js). Serves this demo three
// ways: see ../../e2e-kit/serve.mjs.
import { fileURLToPath } from "node:url";
import * as vite from "vite";
import { serveDemo } from "../../e2e-kit/serve.mjs";
import { ports } from "./ports.js";

await serveDemo({
  vite,
  demoDir: fileURLToPath(new URL("..", import.meta.url)),
  ports,
});
