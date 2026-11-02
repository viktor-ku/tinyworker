import z from "zod";
import { createWorkerFn } from "../../src/lib.js";

export const withDefault = createWorkerFn({
  input: z.number().optional(),
  output: z.number(),
}).handler((n) => n ?? 0);
