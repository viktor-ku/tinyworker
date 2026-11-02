// Runs in real browsers (Chromium, WebKit) with native module workers and
// unmodified library code. Each test asserts the CORRECT behaviour, so a
// failure reproduces a bug.
import { afterEach, describe, expect, it } from "vitest";
import {
  onUnhandledRejection,
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

const math = workerModule("../fixtures/math.worker.js");

describe("harness sanity (should pass)", () => {
  it("pool.double(21) resolves to 42", async () => {
    const pool = createWorkerPool(math, { workers: 1 });
    await expect(within(pool.double(21))).resolves.toBe(42);
  });
});

describe("bug: errors never reach the caller", () => {
  it("a handler that throws rejects the call", async () => {
    const pool = createWorkerPool(workerModule("../fixtures/fail.worker.js"), {
      workers: 1,
    });
    await expect(within(pool.fail(1))).rejects.toThrow("boom");
  });

  it("input that fails the schema rejects the call", async () => {
    const pool = createWorkerPool(workerModule("../fixtures/fail.worker.js"), {
      workers: 1,
    });
    await expect(within(pool.fail("not a number"))).rejects.toThrow(
      /expected number/i,
    );
  });
});

describe("bug: the method name is ignored", () => {
  it("pool.negate(5) runs negate, not double", async () => {
    const pool = createWorkerPool(math, { workers: 1 });
    await expect(within(pool.negate(5))).resolves.toBe(-5);
  });

  it("calling a function the worker doesn't export rejects", async () => {
    const pool = createWorkerPool(math, { workers: 1 });
    await expect(within(pool.doesNotExist(5))).rejects.toThrow();
  });
});

describe("bug: a busy worker is reported as available", () => {
  it("a 1-worker pool never runs two jobs at the same time", async () => {
    const pool = createWorkerPool(workerModule("../fixtures/slow.worker.js"), {
      workers: 1,
    });
    const results = await within(
      Promise.all([pool.slow(1), pool.slow(2), pool.slow(3), pool.slow(4)]),
      3000,
    );
    // Each result is the most jobs the worker ever ran at once.
    expect(results).toEqual([1, 1, 1, 1]);
  });
});

describe("bug: the runner keeps every message in memory", () => {
  it("memory stays flat after 200 sequential calls", async () => {
    const runner = new WorkerRunner(
      new URL("./fixtures/echo.worker.js", import.meta.url),
      { workerOptions: { type: "module" } },
    );
    for (let i = 0; i < 200; i += 1) {
      await within(runner.postMessage(msg.Com(i)));
    }
    // Give the delayed ping after the last reply time to arrive.
    await new Promise((r) => setTimeout(r, 20));
    expect(runner.channel.inner.size).toBeLessThan(5);
    runner.worker.terminate();
  });
});

describe("bug: the pool proxy looks like a promise", () => {
  it("can be returned from an async function", async () => {
    const unhandled = [];
    const stopListening = onUnhandledRejection((err) =>
      unhandled.push(String(err)),
    );

    try {
      const pool = createWorkerPool(math, { workers: 1 });
      expect
        .soft(typeof pool.then, "pool should not be thenable")
        .toBe("undefined");

      const makePool = async () => createWorkerPool(math, { workers: 1 });
      await expect
        .soft(within(makePool(), 500), "async function returning a pool")
        .resolves.toBeDefined();
    } finally {
      await new Promise((r) => setTimeout(r, 0));
      stopListening();
      expect.soft(unhandled, "no unhandled rejections").toEqual([]);
    }
  });
});

describe("bug: schema output is thrown away", () => {
  it("the handler receives the transformed input", async () => {
    const pool = createWorkerPool(
      workerModule("../fixtures/schema.worker.js"),
      { workers: 1 },
    );
    await expect(within(pool.shout("hello"))).resolves.toBe("HELLO");
  });

  it("an optional input may be left out", async () => {
    const pool = createWorkerPool(
      workerModule("../fixtures/optional.worker.js"),
      { workers: 1 },
    );
    await expect(within(pool.withDefault())).resolves.toBe(0);
  });
});
