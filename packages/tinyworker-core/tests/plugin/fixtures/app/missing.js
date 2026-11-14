import { createWorkerPool } from "@tinyworker/core";

export const pool = createWorkerPool(() => import("./missing-worker.js"));
