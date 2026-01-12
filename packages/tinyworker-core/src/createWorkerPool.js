import { WorkerRunner } from "./WorkerRunner.js";
import { extractUrl } from "./utils.js";
import { createObserver } from "./createObserver.js";
import * as msg from "./message.js";

export function createWorkerPool(mod, config) {
  const maxWorkers = config?.workers ?? 2;
  const pool = [];

  const workerUrl = extractUrl(mod.toString());
  const workerOptions = { type: "module" };

  const queue = [];
  const completed = createObserver([]);

  for (let i = 0, len = maxWorkers; i < len; i += 1) {
    const runner = new WorkerRunner(workerUrl, {
      workerOptions,
      id: i + 1,
    });

    pool.push(runner);

    runner.available.subscribe((online) => {
      if (online) {
        const task = queue.shift();

        if (task) {
          runner.postMessage(task).then((result) => {
            completed.notify(result);
          });
        }
      }
    });
  }

  function acceptJob(prop, input) {
    const task = msg.Com(input);
    const runnerIndex = pool.findIndex((it) => it.available());

    if (runnerIndex >= 0) {
      return pool[runnerIndex].postMessage(task);
    }

    queue.push(task);

    return new Promise((resolve) => {
      const unsub = completed.subscribe((someMessage) => {
        if (msg.sameId(task, someMessage)) {
          unsub();
          resolve(someMessage);
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
