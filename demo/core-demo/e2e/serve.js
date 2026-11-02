// Started by Playwright (see playwright.config.js). Builds @tinyworker/core,
// then serves the demo two ways:
//   http://localhost:5181  Vite dev server
//   http://localhost:5182  production build (vite build + vite preview)
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createServer, preview } from "vite";

const demoDir = fileURLToPath(new URL("..", import.meta.url));
const coreDir = fileURLToPath(new URL("../../../packages/tinyworker-core", import.meta.url));

// The demo imports @tinyworker/core from its dist/, so build that first, with
// the core package's own Vite.
execFileSync(process.execPath, [join(coreDir, "node_modules/vite/bin/vite.js"), "build"], {
  cwd: coreDir,
  stdio: "inherit",
});

const dev = await createServer({
  root: demoDir,
  server: { port: 5181, strictPort: true },
});
await dev.listen();

const outDir = mkdtempSync(join(tmpdir(), "tinyworker-demo-"));
await build({ root: demoDir, logLevel: "warn", build: { outDir, emptyOutDir: true } });
await preview({
  root: demoDir,
  build: { outDir },
  preview: { port: 5182, strictPort: true },
});

console.log("demo: dev on :5181, production build on :5182");
