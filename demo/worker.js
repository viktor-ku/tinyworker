import z from "zod";
import { createWorkerFn } from "../src/createWorkerFn";

export const double = createWorkerFn({
  input: z.number(),
  output: z.number(),
}).handler((it) => {
  for (let i = 0; i < 1e7; i += 1) {
    let _ = Array(100)
      .fill(i)
      .map((it) => it ** 2);
  }
  return it ** 2;
});
