import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    modulePreload: {
      polyfill: false,
    },
    lib: {
      formats: ["es", "umd"],
      entry: resolve(__dirname, "src/lib.js"),
      name: "tinyworker",
      fileName: "tinyworker",
    },
    rolldownOptions: {
      checks: {
        circularDependency: true,
        configurationFieldConflict: true,
        emptyImportMeta: true,
        filenameConflict: true,
        importIsUndefined: true,
        missingGlobalName: true,
        mixedExport: true,
        unresolvedEntry: true,
        unresolvedImport: true,
      },
    },
  },
});
