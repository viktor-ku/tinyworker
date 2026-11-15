// The plugin inside a real Vite: a production build and the dev server, on a
// small app whose worker shares a module with it (tests/plugin/fixtures/app).
// The demos (demo/*) run the same in browsers, built with Vite and Rollup;
// this runs on the Vite this package is built with, which uses Rolldown.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build, createServer, parseAst } from "vite";
import { describe, expect, it } from "vitest";
import { tinyworker } from "../../plugin/vite.js";

const root = fileURLToPath(new URL("./fixtures/app/", import.meta.url));
const lib = fileURLToPath(new URL("../../src/lib.js", import.meta.url));

function config(plugins, logger) {
  return {
    root,
    configFile: false,
    logLevel: "silent",
    customLogger: logger,
    plugins,
    // The fixture imports the package by name, as an app would.
    resolve: { alias: { "@tinyworker/core": lib } },
  };
}

async function buildApp(entry, plugins, logger, options = {}) {
  const result = await build({
    ...config(plugins, logger),
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: `${root}${entry}` },
      ...options,
    },
  });
  const files = result.output;

  return {
    chunks: files.filter((it) => it.type === "chunk"),
    workers: files.filter(
      (it) => it.type === "asset" && it.fileName.startsWith("assets/worker-"),
    ),
  };
}

/**
 * The source file and 1-based line that a 1-based line of generated code maps
 * to, read from the first segment of that line in a version 3 source map.
 */
function originalLine(map, line) {
  const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const state = [0, 0, 0, 0]; // column, source, original line, original column
  const lines = map.mappings.split(";");

  for (let i = 0; i < line; i += 1) {
    state[0] = 0;
    for (const segment of lines[i].split(",").filter(Boolean)) {
      let field = 0;
      let value = 0;
      let shift = 0;
      for (const char of segment) {
        const digit = BASE64.indexOf(char);
        value += (digit & 31) << shift;
        shift += 5;
        if ((digit & 32) === 0) {
          const signed = value & 1 ? -(value >>> 1) : value >>> 1;
          if (field < 4) state[field] += signed;
          field += 1;
          value = 0;
          shift = 0;
        }
      }
      if (i === line - 1) {
        return { source: map.sources[state[1]], line: state[2] + 1 };
      }
    }
  }

  return undefined;
}

function lineOf(code, text) {
  return code.slice(0, code.indexOf(text)).split("\n").length;
}

function recordingLogger() {
  const warnings = [];
  const ignore = () => {};
  return {
    warnings,
    info: ignore,
    warn: (msg) => warnings.push(msg),
    warnOnce: (msg) => warnings.push(msg),
    error: ignore,
    clearScreen: ignore,
    hasErrorLogged: () => false,
    hasWarned: false,
  };
}

describe("production build", () => {
  it("without the plugin, the worker is a chunk of the app that loads the app (#1)", async () => {
    const { chunks, workers } = await buildApp("main.js", []);
    const app = chunks.find((it) => it.isEntry);
    const worker = chunks.find((it) => it.isDynamicEntry);

    // This is the failure the plugin exists for; if it stops happening, the
    // tests below no longer prove anything.
    expect(workers).toEqual([]);
    expect(worker.imports).toContain(app.fileName);
  });

  it("with the plugin, the worker is a bundle of its own that never loads the app", async () => {
    const { chunks, workers } = await buildApp("main.js", [tinyworker()]);

    expect(chunks.map((it) => it.isEntry)).toEqual([true]);
    const [app] = chunks;

    expect(workers).toHaveLength(1);
    const [worker] = workers;
    const workerCode = String(worker.source);

    expect(workerCode).toContain("hello");
    expect(workerCode).not.toContain("document.title");
    expect(workerCode).not.toContain(app.fileName);

    // Rolldown spells it `new URL(/* @vite-ignore */ "/assets/…", "" + import.meta.url)`.
    expect(app.code).toMatch(
      new RegExp(
        String.raw`new Worker\(new URL\([^)]*"/${worker.fileName.replaceAll(".", "\\.")}"[^)]*import\.meta\.url\s*\)`,
      ),
    );
    expect(app.code).not.toMatch(/import\(\s*["']\.\/worker/);
  });

  it("keeps the app's source map right, line for line", async () => {
    const logger = recordingLogger();
    const { chunks } = await buildApp("main.js", [tinyworker()], logger, {
      sourcemap: true,
    });
    const [app] = chunks;
    const source = await readFile(`${root}main.js`, "utf8");

    // A transform without a map would get "Sourcemap is likely to be incorrect".
    expect(logger.warnings.filter((it) => /source ?map/i.test(it))).toEqual([]);

    for (const text of ["createWorkerPool(void 0", "document.title = greeting"]) {
      const original = text.startsWith("createWorkerPool")
        ? "createWorkerPool("
        : text;
      expect(originalLine(app.map, lineOf(app.code, text)), text).toEqual({
        source: expect.stringMatching(/(^|\/)main\.js$/),
        line: lineOf(source, original),
      });
    }
  });

  it("warns about a pool call it can't rewrite, naming the plugin and the file", async () => {
    const logger = recordingLogger();
    await buildApp("dynamic.js", [tinyworker()], logger);

    const warnings = logger.warnings.filter((it) => it.includes("not rewritten"));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("tinyworker");
    expect(warnings[0]).toContain(`${root}dynamic.js:4:21`);
  });

  it("fails when the worker module doesn't exist", async () => {
    await expect(
      buildApp("missing.js", [tinyworker()], recordingLogger()),
    ).rejects.toThrow('cannot find the worker module "./missing-worker.js"');
  });
});

describe("transform hook", () => {
  it("returns map: null, which tells the bundler every line kept its place", async () => {
    // Without a map field, Rollup warns "Sourcemap is likely to be incorrect"
    // when source maps are on; Rolldown doesn't, so this is checked here.
    const context = {
      parse: parseAst,
      resolve: async () => ({ id: `${root}worker.js` }),
      warn: () => {},
      error: (message) => {
        throw new Error(message);
      },
    };
    const code = await readFile(`${root}main.js`, "utf8");

    const result = await tinyworker().transform.handler.call(
      context,
      code,
      `${root}main.js`,
    );

    expect(result).toStrictEqual({ code: expect.any(String), map: null });
    expect(result.code).toContain("spawn: () => new Worker(");
  });
});

describe("dev server", () => {
  it("serves the app with the worker as a worker file of its own", async () => {
    const server = await createServer({
      ...config([tinyworker()]),
      appType: "custom",
      server: { middlewareMode: true, ws: false },
    });

    try {
      const result = await server.transformRequest("/main.js");

      expect(result.code).toMatch(
        /new Worker\(new URL\(\s*(\/\* @vite-ignore \*\/\s*)?"\/worker\.js\?worker_file&type=module"/,
      );
      expect(result.code).not.toMatch(/import\(\s*["']\.\/worker/);
    } finally {
      await server.close();
    }
  });
});
