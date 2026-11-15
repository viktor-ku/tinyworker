// Builds @tinyworker/core, then serves one demo three ways. Each demo's
// e2e/serve.js calls this, and Playwright starts that file (see
// playwright.mjs).
//
//   ports.dev          Vite dev server
//   ports.production   `vite build`, served by `vite preview`
//   ports.unminified   `vite build --minify false`, served the same way
//
// The unminified build is there because bundlers print code differently when
// they don't minify (single quotes, other names), and a pool must not depend
// on what the built source text looks like.
//
// This file has no node_modules of its own to import from, so each demo
// passes in its own copy of Vite.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const coreDir = fileURLToPath(
  new URL("../../packages/tinyworker-core", import.meta.url),
);

/** Runs `vite build` in `cwd` with that package's own Vite, as a user would. */
function viteBuild(cwd, args = []) {
  // Vite builds for whatever NODE_ENV it is handed, and sets it for the rest
  // of the process when it is unset. Take it out, so that neither the shell
  // nor a Vite server started below can turn this into a development build.
  const { NODE_ENV: _, ...env } = process.env;

  execFileSync(
    process.execPath,
    [join(cwd, "node_modules/vite/bin/vite.js"), "build", ...args],
    { cwd, env, stdio: "inherit" },
  );
}

export async function serveDemo({ vite, demoDir, ports }) {
  // The demos import @tinyworker/core from its dist/, so build that first.
  viteBuild(coreDir);

  const builds = [
    { port: ports.production, args: [] },
    { port: ports.unminified, args: ["--minify", "false"] },
  ];

  for (const { port, args } of builds) {
    const outDir = mkdtempSync(join(tmpdir(), "tinyworker-demo-"));
    viteBuild(demoDir, ["--outDir", outDir, "--emptyOutDir", "--logLevel", "warn", ...args]);

    // For the same reason, each server works out its own NODE_ENV.
    delete process.env.NODE_ENV;
    await vite.preview({
      root: demoDir,
      build: { outDir },
      preview: { port, strictPort: true },
    });
  }

  // Last, because Playwright waits for this port before it runs the tests.
  delete process.env.NODE_ENV;
  const dev = await vite.createServer({
    root: demoDir,
    server: { port: ports.dev, strictPort: true },
  });
  await dev.listen();

  console.log(
    `demo: dev on :${ports.dev}, production build on :${ports.production}, unminified build on :${ports.unminified}`,
  );
}
