import { Channel } from "./channel.js";
import * as msg from "./message.js";

export class WorkerRunner {
  constructor(workerUrl, config) {
    this.available = new Channel(true);
    this.channel = new Channel();

    this.worker = new Worker(workerUrl, config.workerOptions);
    this.worker.addEventListener("message", this.recv.bind(this));
  }

  recv(e) {
    this.available.tx(true);
    this.channel.tx(e);
  }

  postMessage(message) {
    this.available.tx(false);

    return new Promise((resolve) => {
      this.channel.recv(({ next, ack }) => {
        const otherMessage = next.data;

        if (msg.sameId(message, otherMessage)) {
          ack();
          resolve(otherMessage);
        }
      });

      this.worker.postMessage(message);
    });
  }
}
