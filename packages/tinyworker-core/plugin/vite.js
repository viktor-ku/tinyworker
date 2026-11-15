// The `@tinyworker/core/vite` plugin. With it, the pool is written with the
// worker path once:
//
//   const pool = createWorkerPool(() => import("./worker"));
//
// and a production build still gives the worker a bundle of its own. See
// rewrite.js for what it changes.
import { rewritePoolCalls } from "./rewrite.js";

export function tinyworker() {
  return {
    name: "tinyworker",
    transform: {
      // Vite, Rollup and Rolldown skip the hook when this doesn't match; older
      // versions ignore `filter`, and rewritePoolCalls checks again.
      filter: { code: /createWorkerPool/ },
      async handler(code, id) {
        let result;

        try {
          result = await rewritePoolCalls(code, {
            importer: id,
            parse: (it) => this.parse(it),
            resolve: async (specifier, importer) => {
              const resolved = await this.resolve(specifier, importer);
              return resolved && !resolved.external ? resolved.id : null;
            },
          });
        } catch (err) {
          this.error(err.message, err.pos);
        }

        if (!result) {
          return null;
        }

        for (const it of result.warnings) {
          this.warn(it.message, it.pos);
        }

        // map: null says the code kept its lines, so earlier source maps
        // still hold; see rewrite.js.
        return result.code === null ? null : { code: result.code, map: null };
      },
    },
  };
}

export default tinyworker;
