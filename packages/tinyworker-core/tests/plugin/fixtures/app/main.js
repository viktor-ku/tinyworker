import { createWorkerPool } from "@tinyworker/core";
import { greeting } from "./shared.js";

export const pool = createWorkerPool(() => import("./worker.js"));

// Throws in a worker: there is no document there.
document.title = greeting;
