// Type tests for the `spawn` option. Nothing here runs: `bun run typecheck`
// compiles this file, and each `@ts-expect-error` fails the compile if the
// line under it stops being an error.
import { createWorkerPool } from "../../index.js";

// Stands in for `() => import("./worker")`.
declare const mod: () => Promise<{
  double: (input: number) => Promise<number>;
}>;

const spawn = () =>
  new Worker(new URL("./worker.js", import.meta.url), { type: "module" });

// With spawn, the pool is still typed from the module.
const pool = createWorkerPool(mod, { workers: 1, spawn });
export const doubled: Promise<number> = pool.double(2);

// It is the same type as without spawn.
export const same: typeof pool = createWorkerPool(mod);

// Leaving spawn out can be written as `undefined`, e.g. `dev ? undefined : fn`.
export const fallback: typeof pool = createWorkerPool(mod, { spawn: undefined });

// @ts-expect-error the module has no such function
pool.triple;

// @ts-expect-error double takes a number
pool.double("2");

// @ts-expect-error a Worker in place of a function that returns one
createWorkerPool(mod, { spawn: spawn() });

// @ts-expect-error spawn returns a URL, not a Worker
createWorkerPool(mod, { spawn: () => new URL("./worker.js", import.meta.url) });

// @ts-expect-error spawn returns the module promise, not a Worker
createWorkerPool(mod, { spawn: mod });
