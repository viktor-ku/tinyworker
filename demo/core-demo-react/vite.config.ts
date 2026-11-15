import react from "@vitejs/plugin-react";
import { tinyworker } from "@tinyworker/core/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // tinyworker() lets `createWorkerPool(() => import("./worker"))` work in a
  // production build. It goes after the plugins that compile the source.
  plugins: [react(), tinyworker()],
  server: {
    port: 3001,
  },
  build: {
    target: "esnext",
  },
});
