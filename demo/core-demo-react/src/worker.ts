import z from "zod";
import { createWorkerFn } from "@tinyworker/core";
import { numberToDouble } from "./schema";

export const double = createWorkerFn({
  input: numberToDouble,
  output: z.number(),
}).handler((it) => {
  return it * 2;
});
