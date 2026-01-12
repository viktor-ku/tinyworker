import z from "zod";
import { createWorkerFn } from "@tinyworker/core";

export const double = createWorkerFn({
  input: z.number(),
  output: z.number(),
}).handler((it) => {
  return it * 2;
});
