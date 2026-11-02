import z from "zod";
import { createWorkerFn } from "../../src/lib.js";

// One export only, so the "method name ignored" bug can't affect this test.
export const fail = createWorkerFn({
  input: z.number(),
}).handler(() => {
  throw new Error("boom");
});
