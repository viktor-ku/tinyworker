import { createWorkerFn } from "../../src/lib.js";

// One export only, so each request gets exactly one reply.
export const echo = createWorkerFn({}).handler((x) => x);
