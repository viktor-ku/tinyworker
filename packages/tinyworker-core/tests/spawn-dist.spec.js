// The `spawn` option in the files that are published: dist/tinyworker.js (the
// `import` export) and dist/tinyworker.umd.cjs (the `require` export, also
// usable from a <script> tag). tests/setup/build-dist.js rebuilds dist/ before
// the run.
import { afterEach, expect, it } from "vitest";
import { terminateAllWorkers, trackWorkers, within } from "./harness/env.js";

trackWorkers();
afterEach(terminateAllWorkers);

const echoUrl = new URL("./fixtures/echo.worker.js", import.meta.url);
const spawn = () => new Worker(echoUrl, { type: "module" });

// With spawn the pool must not look at its first argument at all.
const unusedModule = () => {
  throw new Error("the module function must not be called");
};

async function loadUmdWithScriptTag() {
  const res = await fetch("/dist/tinyworker.umd.cjs");
  expect(res.ok, "dist/tinyworker.umd.cjs should be built").toBe(true);
  // Served as text/javascript, like a CDN would serve it.
  const blob = new Blob([await res.text()], { type: "text/javascript" });
  const script = document.createElement("script");
  script.src = URL.createObjectURL(blob);
  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  return globalThis.tinyworker;
}

it("the built ES module runs a pool of spawned workers", async () => {
  // A variable, so Vite serves the built file as it is.
  const built = "/dist/tinyworker.js";
  const { createWorkerPool } = await import(/* @vite-ignore */ built);

  const pool = createWorkerPool(unusedModule, { workers: 1, spawn });
  await expect(within(pool.echo("es"))).resolves.toBe("es");
});

it("the UMD build loaded with <script> runs a pool of spawned workers", async () => {
  const tinyworker = await loadUmdWithScriptTag();

  // The UMD build has no `import.meta.url`, so without spawn this throws (#9).
  const pool = tinyworker.createWorkerPool(unusedModule, { workers: 1, spawn });
  await expect(within(pool.echo("umd"))).resolves.toBe("umd");
});
