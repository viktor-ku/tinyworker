import { describe, expect, it } from "vitest";
import { extractUrl } from "../src/utils.js";

describe("bug: extractUrl parses function source text", () => {
  it("handles single-quoted imports (exact output of `vite build --minify false` on the demo)", () => {
    const fnSource =
      "() => __vitePreload(() => import('./worker-C-DjJ6m-.js'),true              ?[]:void 0)";
    expect(() => extractUrl(fnSource)).not.toThrow();
  });

  it("resolves a relative path against the caller, not against tinyworker's own file", () => {
    // Written in a file under tests/, so "./worker.js" means tests/worker.js.
    const url = extractUrl('() => import("./worker.js")');
    expect(url.href).toBe(new URL("./worker.js", import.meta.url).href);
  });
});
