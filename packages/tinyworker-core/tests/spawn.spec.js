// The `spawn` option: the caller creates each worker, so the pool never has to
// work out a worker URL from the source text of `() => import("./worker.js")`.
// That is what lets a bundler build the worker as its own bundle (#1).
//
// Runs in real browsers (Chromium, WebKit) with native module workers.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  terminateAllWorkers,
  trackWorkers,
  within,
  workerModule,
} from "./harness/env.js";
import { createWorkerPool } from "../src/lib.js";
import { WorkerRunner } from "../src/WorkerRunner.js";
import * as msg from "../src/message.js";

trackWorkers();
afterEach(terminateAllWorkers);

// Captured after trackWorkers(), so workers made here are still cleaned up
// when a test swaps the global `Worker` for something else.
const TrackedWorker = globalThis.Worker;
const echoUrl = new URL("./fixtures/echo.worker.js", import.meta.url);
const spawnEcho = () => new TrackedWorker(echoUrl, { type: "module" });

/** Stands in for `() => import("./worker.js")` where it must stay unused. */
function untouchableModule() {
  const mod = () => {
    throw new Error("the module function must not be called");
  };
  mod.toString = () => {
    throw new Error("the module function's source must not be read");
  };
  return mod;
}

describe("spawn: the caller creates the workers", () => {
  it("runs a call on a worker written the way a bundler detects it", async () => {
    const pool = createWorkerPool(untouchableModule(), {
      workers: 1,
      spawn: () =>
        new Worker(new URL("./fixtures/echo.worker.js", import.meta.url), {
          type: "module",
        }),
    });

    await expect(within(pool.echo("hi"))).resolves.toBe("hi");
  });

  it("never calls the module function and never reads its source", async () => {
    const mod = untouchableModule();
    const called = vi.fn(mod);
    called.toString = vi.fn(mod.toString);

    const pool = createWorkerPool(called, { workers: 1, spawn: spawnEcho });
    await expect(within(pool.echo(1))).resolves.toBe(1);

    expect(called).not.toHaveBeenCalled();
    expect(called.toString).not.toHaveBeenCalled();
  });

  it("never constructs a Worker itself", async () => {
    const constructed = vi.fn();
    globalThis.Worker = class {
      constructor(...args) {
        constructed(...args);
        throw new Error("the pool must only use workers that spawn returned");
      }
    };

    try {
      const pool = createWorkerPool(untouchableModule(), { spawn: spawnEcho });
      await expect(within(pool.echo("mine"))).resolves.toBe("mine");
    } finally {
      globalThis.Worker = TrackedWorker;
    }

    expect(constructed).not.toHaveBeenCalled();
  });

  it("calls spawn once for each worker: 2 by default", () => {
    const spawn = vi.fn(spawnEcho);
    createWorkerPool(untouchableModule(), { spawn });
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it("calls spawn once for each worker: as many as `workers` says", () => {
    for (const workers of [1, 3]) {
      const spawn = vi.fn(spawnEcho);
      createWorkerPool(untouchableModule(), { workers, spawn });
      expect(spawn, `workers: ${workers}`).toHaveBeenCalledTimes(workers);
    }
  });

  it("calls spawn with no arguments", () => {
    const spawn = vi.fn(spawnEcho);
    createWorkerPool(untouchableModule(), { workers: 1, spawn });
    expect(spawn).toHaveBeenCalledWith();
  });

  it("gives concurrent calls their own results, queued ones included", async () => {
    const pool = createWorkerPool(untouchableModule(), {
      workers: 2,
      spawn: spawnEcho,
    });
    const inputs = ["a", "b", "c", "d", "e", "f"];

    await expect(
      within(Promise.all(inputs.map((it) => pool.echo(it)))),
    ).resolves.toEqual(inputs);
  });

  it("keeps serving calls one after another", async () => {
    const pool = createWorkerPool(untouchableModule(), {
      workers: 1,
      spawn: spawnEcho,
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(within(pool.echo(i))).resolves.toBe(i);
    }
  });
});

describe("spawn: a mistake fails when the pool is created, not as a hang", () => {
  it.for([
    ["a string", "./worker.js", "string"],
    ["a number", 2, "number"],
    ["null", null, "null"],
    ["an object", {}, "Object"],
  ])("rejects %s in place of a function", ([, spawn, name]) => {
    expect(() => createWorkerPool(untouchableModule(), { spawn })).toThrow(
      new TypeError(
        `createWorkerPool: \`spawn\` must be a function that returns a Worker, got ${name}`,
      ),
    );
  });

  it("rejects a Worker in place of a function", () => {
    // `spawn: new Worker(...)` with the arrow function forgotten.
    const spawn = spawnEcho();

    expect(() => createWorkerPool(untouchableModule(), { spawn })).toThrow(
      new TypeError(
        `createWorkerPool: \`spawn\` must be a function that returns a Worker, got ${TrackedWorker.name}`,
      ),
    );
  });

  it.for([
    ["nothing", () => undefined, "undefined"],
    ["null", () => null, "null"],
    ["a URL", () => echoUrl, "URL"],
    ["a string", () => echoUrl.href, "string"],
    // What `spawn: () => import("./worker.js")` would return.
    ["a promise", () => Promise.resolve({}), "Promise"],
    ["a message port", () => new MessageChannel().port1, "MessagePort"],
    ["an object without a prototype", () => Object.create(null), "object"],
  ])("rejects a spawn that returns %s", ([, spawn, name]) => {
    expect(() => createWorkerPool(untouchableModule(), { spawn })).toThrow(
      new TypeError(
        `createWorkerPool: \`spawn\` must return a Worker, got ${name}`,
      ),
    );
  });

  it("rejects a spawn that returns the same worker twice", () => {
    const worker = spawnEcho();

    expect(() =>
      createWorkerPool(untouchableModule(), { spawn: () => worker }),
    ).toThrow(
      new TypeError(
        "createWorkerPool: `spawn` must return a new Worker on every call",
      ),
    );
  });

  it("lets an error thrown by spawn through unchanged", () => {
    const failure = new Error("no worker for you");
    let thrown;

    try {
      createWorkerPool(untouchableModule(), {
        spawn: () => {
          throw failure;
        },
      });
    } catch (err) {
      thrown = err;
    }

    // The very same object, not a copy or a wrapper.
    expect(thrown).toBe(failure);
  });

  it("stops the workers that did start when a later spawn fails", () => {
    const started = [];
    const spawn = () => {
      if (started.length === 2) {
        throw new Error("third worker failed");
      }
      const worker = spawnEcho();
      vi.spyOn(worker, "terminate");
      started.push(worker);
      return worker;
    };

    expect(() =>
      createWorkerPool(untouchableModule(), { workers: 3, spawn }),
    ).toThrow("third worker failed");

    expect(started).toHaveLength(2);
    for (const worker of started) {
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    }
  });

  it("stops the workers that did start when a later spawn returns a non-worker", () => {
    const first = spawnEcho();
    vi.spyOn(first, "terminate");
    const results = [first, "not a worker"];

    expect(() =>
      createWorkerPool(untouchableModule(), { spawn: () => results.shift() }),
    ).toThrow(TypeError);

    expect(first.terminate).toHaveBeenCalledTimes(1);
  });

  it("stops a worker that spawn returned but the pool could not use", () => {
    // Passes for a worker until the pool listens on it: a Proxy around a
    // native Worker throws "Illegal invocation" on every native method.
    const terminate = vi.fn();
    const broken = new Proxy(spawnEcho(), {
      get: (worker, key) =>
        key === "terminate" ? terminate : Reflect.get(worker, key),
    });

    expect(() =>
      createWorkerPool(untouchableModule(), { workers: 1, spawn: () => broken }),
    ).toThrow(TypeError);

    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("reports the spawn failure even when stopping a worker fails too", () => {
    const failure = new Error("third worker failed");
    const started = [];
    const spawn = () => {
      if (started.length === 2) {
        throw failure;
      }
      const worker = spawnEcho();
      const terminate = vi.spyOn(worker, "terminate");
      if (started.length === 0) {
        // Once only: the cleanup after this test must still stop the worker.
        terminate.mockImplementationOnce(() => {
          throw new Error("terminate failed");
        });
      }
      started.push(worker);
      return worker;
    };
    let thrown;

    try {
      createWorkerPool(untouchableModule(), { workers: 3, spawn });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBe(failure);
    // The first worker's failure did not stop the second from being stopped.
    expect(started[0].terminate).toHaveBeenCalledTimes(1);
    expect(started[1].terminate).toHaveBeenCalledTimes(1);
  });
});

describe("without spawn: the module function is still read", () => {
  it("falls back when spawn is undefined", async () => {
    const pool = createWorkerPool(workerModule("../fixtures/echo.worker.js"), {
      workers: 1,
      spawn: undefined,
    });

    await expect(within(pool.echo("fallback"))).resolves.toBe("fallback");
  });

  it("still fails at creation when the source has no import()", () => {
    expect(() => createWorkerPool(() => "no import here")).toThrow();
  });
});

describe("WorkerRunner", () => {
  it("drives a Worker it is handed", async () => {
    const worker = spawnEcho();
    const runner = new WorkerRunner(worker, {});

    expect(runner.worker).toBe(worker);

    const request = msg.Com("ping-pong");
    const reply = await within(runner.postMessage(request));
    expect(msg.payload(reply)).toBe("ping-pong");
    expect(msg.sameId(request, reply)).toBe(true);
  });

  it("still creates a Worker from a URL", async () => {
    const runner = new WorkerRunner(echoUrl, {
      workerOptions: { type: "module" },
    });

    expect(runner.worker).toBeInstanceOf(TrackedWorker);

    const reply = await within(runner.postMessage(msg.Com("from a url")));
    expect(msg.payload(reply)).toBe("from a url");
  });
});
