import * as msg from "./message.js";
import { sleep, assertOnWorker, assert, throwAway } from "./utils.js";

export function createWorkerFn(config) {
  const inputSchema = config?.input;
  const outputSchema = config?.output;

  const def = new WorkerDefinition(inputSchema, outputSchema);

  return def;
}

class WorkerJob {
  constructor(workload, inputSchema, outputSchema) {
    this.workload = workload;

    this.inputSchema = inputSchema;
    this.expectInput = !!inputSchema;

    this.outputSchema = outputSchema;
    this.expectOutput = !!outputSchema;
  }

  async run(input) {
    if (this.expectInput) {
      if (typeof input === "undefined") {
        throw new Error(`Expected input, but got nothing`);
      }

      await this.inputSchema.parseAsync(input);
    }

    const output = await this.workload(input);

    if (this.expectOutput) {
      if (typeof output === "undefined") {
        throw new Error(`Expected output, but got nothing`);
      }

      await this.outputSchema.parseAsync(output);
    }

    return output;
  }
}

class WorkerDefinition {
  constructor(inputSchema, outputSchema) {
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
  }

  handler(workload) {
    assertOnWorker();
    assert(!this.job, "must never call .handler more than once");

    this.job = new WorkerJob(workload, this.inputSchema, this.outputSchema);

    self.addEventListener("message", this.recv.bind(this));

    return throwAway;
  }

  send(message, delay) {
    if (typeof delay === "number") {
      sleep(delay).finally(() => {
        self.postMessage(message);
      });
    } else {
      self.postMessage(message);
    }
  }

  async recv(e) {
    const message = e.data;

    if (msg.isPing(message)) {
      this.send(msg.Ping());
      return;
    }

    try {
      const result = await this.job.run(msg.payload(message));
      this.send(msg.Com(result, msg.id(message)));
    } catch (err) {
      this.send(msg.Err(err));
    } finally {
      this.send(msg.Ping(), 0);
    }
  }
}
