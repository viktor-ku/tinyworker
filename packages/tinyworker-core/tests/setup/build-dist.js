// Vitest global setup (runs once in Node before the browser tests): rebuild
// dist/ so the UMD test checks the current source.
import { build } from "vite";
import { fileURLToPath } from "node:url";

export default async function setup() {
  await build({
    root: fileURLToPath(new URL("../..", import.meta.url)),
    logLevel: "error",
  });
}
