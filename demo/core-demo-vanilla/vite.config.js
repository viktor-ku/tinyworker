import { tinyworker } from "@tinyworker/core/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // tinyworker() lets `createWorkerPool(() => import("./worker.js"))` work in
  // a production build.
  plugins: [tinyworker()],
  server: {
    port: 3002,
  },
  build: {
    target: "esnext",
  },
});
