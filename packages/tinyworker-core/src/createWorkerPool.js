import { WorkerRunner } from "./WorkerRunner.js";
import { extractUrl, isWorkerLike, typeName } from "./utils.js";
import { Channel } from "./channel.js";
import * as msg from "./message.js";

/**
 * Returns the function that creates one worker.
 *
 * With `config.spawn` the caller creates the worker, and `mod` is used for
 * its type only: it is never called and its source text is never read.
 * Without it, the worker URL is read out of `mod`'s source text. That only
 * works where the bundler leaves `import("...")` alone, so not in a
 * production build.
 */
function createSpawn(mod, spawn) {
  if (typeof spawn === "undefined") {
    const workerUrl = extractUrl(mod.toString());
    const workerOptions = { type: "module" };

    return () => new Worker(workerUrl, workerOptions);
  }

  if (typeof spawn !== "function") {
    throw new TypeError(
      `createWorkerPool: \`spawn\` must be a function that returns a Worker, got ${typeName(spawn)}`,
    );
  }

  const spawned = new WeakSet();

  return () => {
    const worker = spawn();

    if (!isWorkerLike(worker)) {
      throw new TypeError(
        `createWorkerPool: \`spawn\` must return a Worker, got ${typeName(worker)}`,
      );
    }

    // Two runners on one worker would both answer for every reply.
    if (spawned.has(worker)) {
      throw new TypeError(
        "createWorkerPool: `spawn` must return a new Worker on every call",
      );
    }

    spawned.add(worker);

    return worker;
  };
}

export function createWorkerPool(mod, config) {
  const maxWorkers = config?.workers ?? 2;
  const pool = [];

  const spawn = createSpawn(mod, config?.spawn);

  const queue = [];
  const completed = new Channel();

  for (let i = 0, len = maxWorkers; i < len; i += 1) {
    let worker;
    let runner;

    try {
      worker = spawn();
      runner = new WorkerRunner(worker, { id: i + 1 });
    } catch (err) {
      // The pool is never returned, so nobody else can stop the workers that
      // did start. That includes this round's, if it is the runner that threw.
      for (const it of [...pool.map((it) => it.worker), worker]) {
        try {
          it?.terminate();
        } catch {
          // `err` is what the caller needs to see.
        }
      }

      throw err;
    }

    pool.push(runner);

    runner.available.recv(({ next: online }) => {
      if (online) {
        const task = queue.shift();

        if (task) {
          runner.postMessage(task).then((result) => {
            completed.tx(result);
          });
        }
      }
    });
  }

  function acceptJob(prop, input) {
    const task = msg.Com(input);
    const runnerIndex = pool.findIndex((it) => it.available.value());

    if (runnerIndex >= 0) {
      return pool[runnerIndex].postMessage(task).then((it) => msg.payload(it));
    }

    queue.push(task);

    return new Promise((resolve) => {
      completed.recv(({ next, ack }) => {
        if (msg.sameId(task, next)) {
          ack();
          resolve(msg.payload(next));
        }
      });
    });
  }

  return new Proxy(
    {},
    {
      get(_, prop) {
        return acceptJob.bind(null, prop);
      },
    },
  );
}
