// Helpers for tests that run in a real browser (Vitest browser mode with
// Playwright). Nothing is simulated: `Worker`, `self`, structured clone and
// module workers are all native.

const live = new Set();

/**
 * Swaps the global `Worker` for a subclass that records every instance, so
 * `terminateAllWorkers()` can stop the workers each test leaves behind.
 */
export function trackWorkers() {
  const Native = globalThis.Worker;
  if (Native.__tracked) return;

  class TrackedWorker extends Native {
    constructor(...args) {
      super(...args);
      live.add(this);
    }
  }
  TrackedWorker.__tracked = true;
  globalThis.Worker = TrackedWorker;
}

export function terminateAllWorkers() {
  for (const w of live) w.terminate();
  live.clear();
}

export function onUnhandledRejection(fn) {
  const listener = (e) => fn(e.reason);
  window.addEventListener("unhandledrejection", listener);
  return () => window.removeEventListener("unhandledrejection", listener);
}

/**
 * Builds `() => import("<absolute url>")`, the same shape as
 * `() => import("./worker.js")` after Vite rewrites it in dev. `new Function`
 * stops Vitest from rewriting the import() so extractUrl sees normal source.
 */
export function workerModule(relativePath) {
  const href = new URL(relativePath, import.meta.url).href;
  return new Function(`return import(${JSON.stringify(href)})`);
}

/** Rejects if `promise` is still pending after `ms`, so hangs show up as failures. */
export function within(promise, ms = 1000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`promise still pending after ${ms}ms (hang)`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
