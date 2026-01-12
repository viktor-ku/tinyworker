import { createObserver } from "./createObserver.js";
import * as msg from "./message.js";

export class WorkerRunner {
  constructor(workerUrl, config) {
    this.available = createObserver(true);
    this.channel = createObserver([]);

    this.worker = new Worker(workerUrl, config.workerOptions);
    this.worker.addEventListener("message", this.recv.bind(this));
  }

  recv(e) {
    this.available.notify(true);
    this.channel.notify(e);
  }

  postMessage(message) {
    this.available.notify(false);

    return new Promise((resolve) => {
      const unsub = this.channel.subscribe((e) => {
        if (msg.sameId(message, e.data)) {
          unsub();
          resolve(e.data);
        }
      });

      this.worker.postMessage(message);
    });
  }
}
