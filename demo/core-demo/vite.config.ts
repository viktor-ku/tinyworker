import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import { tinyworker } from '@tinyworker/core/vite';

export default defineConfig({
  // tinyworker() lets `createWorkerPool(() => import("./worker.js"))` work in
  // a production build. It goes after the plugins that compile the source.
  plugins: [devtools(), solidPlugin(), tinyworker()],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
});
