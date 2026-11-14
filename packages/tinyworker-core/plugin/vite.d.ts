/**
 * The plugin's shape, spelled out instead of imported from "vite": `Plugin`
 * from "vite" is whichever Vite this file resolves to, which need not be the
 * one the app's config uses (Rolldown-Vite and Vite types don't mix). This
 * shape fits the `plugins` option of either.
 */
export interface TinyworkerPlugin {
  name: "tinyworker";
  transform: {
    filter: { code: RegExp };
    handler(
      code: string,
      id: string,
    ): Promise<{
      code: string;
      map: {
        version: number;
        sources: string[];
        names: string[];
        mappings: string;
      } | null;
    } | null>;
  };
}

/**
 * Lets a pool be written with the worker path once and still work in a
 * production build:
 *
 * ```ts
 * // vite.config.ts
 * import { tinyworker } from "@tinyworker/core/vite";
 * export default defineConfig({ plugins: [react(), tinyworker()] });
 *
 * // App.tsx
 * const pool = createWorkerPool(() => import("./worker"));
 * ```
 *
 * It rewrites each such `createWorkerPool` call to create its workers with
 * `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`,
 * which Vite builds as a worker bundle of its own. List it after the plugins
 * that compile your files (React, Solid, Vue, ...).
 */
export function tinyworker(): TinyworkerPlugin;

export default tinyworker;
