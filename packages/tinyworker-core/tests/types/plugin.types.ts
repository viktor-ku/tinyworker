// Compile-only: checked by `tsc -p .` (bun run typecheck), never run.
// Imported by the package's own name, so this checks the "./vite" export too.
import type { Plugin } from "vite";
import tinyworkerDefault, { tinyworker } from "@tinyworker/core/vite";

export const plugin: Plugin = tinyworker();
export const same: typeof tinyworker = tinyworkerDefault;

// @ts-expect-error It takes no options.
tinyworker({});
