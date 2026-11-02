import z from "zod";
import { createWorkerFn } from "../../src/lib.js";

let active = 0;
let maxActive = 0;

// Returns the highest number of jobs this worker ran at the same time.
export const slow = createWorkerFn({
  input: z.number(),
  output: z.number(),
}).handler(async () => {
  active += 1;
  maxActive = Math.max(maxActive, active);
  await new Promise((r) => setTimeout(r, 50));
  active -= 1;
  return maxActive;
});
