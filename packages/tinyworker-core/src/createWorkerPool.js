import { WorkerRunner } from "./WorkerRunner.js";
import { extractUrl } from "./utils.js";
import { Channel } from "./channel.js";
import * as msg from "./message.js";

export function createWorkerPool(mod, config) {
  const maxWorkers = config?.workers ?? 2;
  const pool = [];

  const workerUrl = extractUrl(mod.toString());
  const workerOptions = { type: "module" };

  const queue = [];
  const completed = new Channel();

  for (let i = 0, len = maxWorkers; i < len; i += 1) {
    const runner = new WorkerRunner(workerUrl, {
      workerOptions,
      id: i + 1,
    });

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
