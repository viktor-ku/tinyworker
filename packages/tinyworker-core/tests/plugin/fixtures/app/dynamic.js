import { createWorkerPool } from "@tinyworker/core";

const path = "./worker.js";
export const pool = createWorkerPool(() => import(/* @vite-ignore */ path));
