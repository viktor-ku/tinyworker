// The UMD build (dist/tinyworker.umd.cjs) is the bundle for a plain <script>
// tag. tests/setup/build-dist.js rebuilds dist/ before the run.
import { afterEach, expect, it } from "vitest";
import { terminateAllWorkers, trackWorkers, workerModule } from "./harness/env.js";

trackWorkers();
afterEach(terminateAllWorkers);

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

it("bug: the UMD build loaded with <script> can create a pool", async () => {
  const tinyworker = await loadUmdWithScriptTag();
  expect(typeof tinyworker?.createWorkerPool).toBe("function");
  expect(() =>
    tinyworker.createWorkerPool(workerModule("../fixtures/echo.worker.js"), {
      workers: 1,
    }),
  ).not.toThrow();
});
