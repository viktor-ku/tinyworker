import z from "zod";
import { createWorkerFn } from "../../src/lib.js";

export const double = createWorkerFn({
  input: z.number(),
  output: z.number(),
}).handler((n) => n * 2);

export const negate = createWorkerFn({
  input: z.number(),
  output: z.number(),
}).handler((n) => -n);

export const fail = createWorkerFn({
  input: z.number(),
}).handler(() => {
  throw new Error("boom");
});
