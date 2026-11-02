import z from "zod";
import { createWorkerFn } from "../../src/lib.js";

// Each file has one export, so the "method name ignored" bug can't affect these tests.
export const shout = createWorkerFn({
  input: z.string().transform((s) => s.toUpperCase()),
  output: z.string(),
}).handler((s) => s);
