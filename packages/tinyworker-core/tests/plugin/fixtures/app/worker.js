import { createWorkerFn } from "@tinyworker/core";
import { greeting } from "./shared.js";

export const greet = createWorkerFn().handler(() => greeting);
