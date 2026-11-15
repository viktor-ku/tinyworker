// What the Vite plugin does to source code, call by call. Uses Vite's own
// parser; the worker path is resolved by a stand-in that maps specifiers to
// files, so each test states where the worker lives.
import { describe, expect, it, vi } from "vitest";
import { parseAst } from "vite";
import { rewritePoolCalls } from "../../plugin/rewrite.js";

const importer = "/app/src/App.js";

function spawnFor(path) {
  return `spawn: () => new Worker(new URL(${JSON.stringify(path)}, import.meta.url), { type: "module" })`;
}

const SPAWN = spawnFor("./worker.ts");

async function rewrite(code, { files = { "./worker": "/app/src/worker.ts" }, from = importer } = {}) {
  const resolve = vi.fn(async (specifier) => files[specifier] ?? null);
  const result = await rewritePoolCalls(code, { importer: from, parse: parseAst, resolve });
  return result && { ...result, resolve };
}

const header = `import { createWorkerPool } from "@tinyworker/core";\n`;

/**
 * Runs rewritten code with `createWorkerPool` and `Worker` stubbed, and returns
 * the arguments each pool call got, so a test checks what the code does rather
 * than how it is spelled.
 */
function poolCalls(code, scope = {}) {
  const calls = [];
  const body = code
    .replace(/^import .*$/gm, "")
    .replaceAll("import.meta.url", JSON.stringify(`file://${importer}`));
  const names = ["createWorkerPool", "Worker", ...Object.keys(scope)];
  new Function(...names, body)(
    (...args) => calls.push(args),
    class Worker {
      constructor(url, options) {
        this.url = String(url);
        this.options = options;
      }
    },
    ...Object.values(scope),
  );
  return calls;
}

/** What the worker of a rewritten pool call is started with. */
function spawned(args) {
  const worker = args[1].spawn();
  return { url: worker.url, options: worker.options };
}

const WORKER = { url: "file:///app/src/worker.ts", options: { type: "module" } };

describe("rewrites a pool call to create its workers", () => {
  it.for([
    [
      "without a config",
      `createWorkerPool(() => import("./worker"));`,
      `createWorkerPool(undefined, { ${SPAWN} });`,
    ],
    [
      "with an empty config",
      `createWorkerPool(() => import("./worker"), {});`,
      `createWorkerPool(undefined, { ${SPAWN},});`,
    ],
    [
      "keeping the config's other options",
      `createWorkerPool(() => import("./worker"), { workers: 3 });`,
      `createWorkerPool(undefined, { ${SPAWN}, workers: 3 });`,
    ],
    [
      "with a config in a variable, which still has the last word",
      `createWorkerPool(() => import("./worker"), config);`,
      `createWorkerPool(undefined, { ${SPAWN}, ...(config) });`,
    ],
    [
      "with a trailing comma",
      `createWorkerPool(() => import("./worker"),);`,
      `createWorkerPool(undefined, { ${SPAWN} });`,
    ],
    [
      "with a comment that has a comma in it",
      `createWorkerPool(() => import("./worker") /* a, b */ // c, d\n);`,
      `createWorkerPool(undefined /* a, b */ // c, d\n, { ${SPAWN} });`,
    ],
  ])("%s", async ([, call, expected]) => {
    const { code } = await rewrite(header + call);
    expect(code).toBe(header + expected);
  });

  it.for([
    ["without a config", `createWorkerPool(() => import("./worker"))`, {}],
    ["with an empty config", `createWorkerPool(() => import("./worker"), {})`, {}],
    ["with options", `createWorkerPool(() => import("./worker"), { workers: 3 })`, { workers: 3 }],
    ["with a config in a variable", `createWorkerPool(() => import("./worker"), config)`, { workers: 5 }],
    ["with a trailing comma", `createWorkerPool(() => import("./worker"),)`, {}],
  ])("so that a call %s runs a pool with spawn", async ([, call, options]) => {
    const { code } = await rewrite(`${header}${call};`);
    const [args, ...more] = poolCalls(code, { config: { workers: 5 } });

    expect(more).toEqual([]);
    expect(args).toHaveLength(2);
    expect(args[0]).toBeUndefined();
    expect(args[1]).toEqual({ ...options, spawn: expect.any(Function) });
    expect(spawned(args)).toEqual(WORKER);
  });

  it("so that a spawn in a config variable still wins", async () => {
    const own = () => "own worker";
    const { code } = await rewrite(`${header}createWorkerPool(() => import("./worker"), config);`);
    const [[, config]] = poolCalls(code, { config: { spawn: own } });

    expect(config.spawn).toBe(own);
  });

  it.for([
    ["an async arrow function", `async () => import("./worker")`],
    ["an arrow function with a block", `() => { return import("./worker"); }`],
    ["a function expression", `function () { return import("./worker"); }`],
    ["single quotes", `() => import('./worker')`],
    ["a template literal", "() => import(`./worker`)"],
    ["parentheses", `(() => (import("./worker")))`],
    ["double parentheses", `((() => import("./worker")))`],
  ])("written as %s", async ([, mod]) => {
    const { code } = await rewrite(`${header}createWorkerPool(${mod});`);
    const [args, ...more] = poolCalls(code);

    expect(more).toEqual([]);
    expect(args).toHaveLength(2);
    expect(args[0]).toBeUndefined();
    expect(spawned(args)).toEqual(WORKER);
    expect(code).not.toContain("import(");
  });

  it("imported under another name", async () => {
    const { code } = await rewrite(
      `import { createWorkerPool as pool } from "@tinyworker/core";\npool(() => import("./worker"));`,
    );
    expect(code).toContain(`pool(undefined, { ${SPAWN} });`);
  });

  it.for([
    ["tw.createWorkerPool"],
    [`tw["createWorkerPool"]`],
  ])("through a namespace import: %s", async ([callee]) => {
    const { code } = await rewrite(
      `import * as tw from "@tinyworker/core";\n${callee}(() => import("./worker"));`,
    );
    expect(code).toContain(`${callee}(undefined, { ${SPAWN} });`);
  });

  it("every call in a file, each with its own worker", async () => {
    const { code } = await rewrite(
      `${header}const a = createWorkerPool(() => import("./a"));\nconst b = createWorkerPool(() => import("./b"), { workers: 1 });`,
      { files: { "./a": "/app/src/a.ts", "./b": "/app/src/b.js" } },
    );
    expect(code).toBe(
      `${header}const a = createWorkerPool(undefined, { ${spawnFor("./a.ts")} });\nconst b = createWorkerPool(undefined, { ${spawnFor("./b.js")}, workers: 1 });`,
    );
  });

  it("calls nested in other code", async () => {
    const { code } = await rewrite(
      `${header}export function make() { return { pool: createWorkerPool(() => import("./worker")) }; }`,
    );
    expect(code).toContain(`createWorkerPool(undefined, { ${SPAWN} })`);
  });
});

describe("points the worker URL at the file the import resolves to", () => {
  it("asks the bundler to resolve the specifier, from the importer", async () => {
    const { resolve } = await rewrite(`${header}createWorkerPool(() => import("./worker"));`);
    expect(resolve).toHaveBeenCalledWith("./worker", importer);
  });

  it.for([
    ["in the same folder", "/app/src/worker.ts", "./worker.ts"],
    ["in a subfolder", "/app/src/workers/math.ts", "./workers/math.ts"],
    ["in a parent folder", "/app/shared/worker.js", "../shared/worker.js"],
    ["in a package", "/app/node_modules/pkg/dist/worker.js", "../node_modules/pkg/dist/worker.js"],
    ["with a query, which is dropped", "/app/src/worker.ts?v=123", "./worker.ts"],
  ])("a file %s", async ([, file, url]) => {
    const { code } = await rewrite(`${header}createWorkerPool(() => import("w"));`, {
      files: { w: file },
    });
    expect(code).toContain(spawnFor(url));
  });

  it("resolves from an importer id that carries a query", async () => {
    const { code } = await rewrite(`${header}createWorkerPool(() => import("./worker"));`, {
      from: "/app/src/App.vue?vue&type=script&setup=true&lang.ts",
    });
    expect(code).toContain(SPAWN);
  });

  it("fails the build, at the import, when the worker can't be found", async () => {
    const code = `${header}createWorkerPool(() => import("./missing"));`;
    await expect(rewrite(code)).rejects.toMatchObject({
      message: 'createWorkerPool: cannot find the worker module "./missing"',
      pos: code.indexOf("() =>"),
    });
  });

  it("fails the build when the worker resolves to a module that is not a file", async () => {
    await expect(
      rewrite(`${header}createWorkerPool(() => import("virtual:w"));`, {
        files: { "virtual:w": "\0virtual:w" },
      }),
    ).rejects.toThrow('createWorkerPool: "virtual:w" resolves to "\0virtual:w", which is not a file');
  });
});

describe("leaves code alone", () => {
  it("when the caller passes spawn", async () => {
    const code = `${header}createWorkerPool(() => import("./worker"), { spawn: () => new Worker("/w.js") });`;
    await expect(rewrite(code)).resolves.toBeNull();
  });

  it("when createWorkerPool comes from another package", async () => {
    const code = `import { createWorkerPool } from "other";\nimport "@tinyworker/core";\ncreateWorkerPool(() => import("./worker"));`;
    await expect(rewrite(code)).resolves.toBeNull();
  });

  it("when only createWorkerFn is imported, as in a worker", async () => {
    const code = `import { createWorkerFn } from "@tinyworker/core";\nexport const createWorkerPool = createWorkerFn().handler(() => {});`;
    await expect(rewrite(code)).resolves.toBeNull();
  });

  it("when the file doesn't mention the package, without parsing it", async () => {
    const parse = vi.fn(parseAst);
    const result = await rewritePoolCalls(`createWorkerPool(() => import("./worker"));`, {
      importer,
      parse,
      resolve: async () => "/app/src/worker.ts",
    });
    expect(result).toBeNull();
    expect(parse).not.toHaveBeenCalled();
  });
});

describe("warns about a pool call it can't rewrite, and leaves it alone", () => {
  it.for([
    ["a variable", `createWorkerPool(mod)`],
    ["a path built at run time", "createWorkerPool(() => import(`./${name}`))"],
    ["a path in a variable", `createWorkerPool(() => import(path))`],
    ["no argument", `createWorkerPool()`],
    ["a function that takes arguments", `createWorkerPool((x) => import("./worker"))`],
    ["a function that does more than import", `createWorkerPool(() => { log(); return import("./worker"); })`],
  ])("a module given as %s", async ([, call]) => {
    const source = `${header}${call};`;
    const result = await rewrite(source);

    expect(result.code).toBeNull();
    expect(result.warnings).toEqual([
      {
        message: expect.stringContaining("is not written as `() => import(\"./worker\")` with a fixed path"),
        pos: header.length,
      },
    ]);
    expect(result.warnings[0].message).toContain("pass `spawn`");
  });

  it("saying where the call is", async () => {
    const result = await rewrite(`${header}\n  createWorkerPool(mod);`, {
      from: "/app/src/App.js?t=1",
    });
    expect(result.warnings[0].message).toMatch(
      /^the createWorkerPool call at \/app\/src\/App\.js:3:3 was not rewritten because /,
    );
  });

  it("spread arguments", async () => {
    const result = await rewrite(`${header}createWorkerPool(...args);`);
    expect(result.code).toBeNull();
    expect(result.warnings).toEqual([
      { message: expect.stringContaining("its arguments are spread"), pos: header.length },
    ]);
  });

  it("while still rewriting the calls it can", async () => {
    const result = await rewrite(
      `${header}createWorkerPool(mod);\ncreateWorkerPool(() => import("./worker"));`,
    );
    expect(result.code).toBe(
      `${header}createWorkerPool(mod);\ncreateWorkerPool(undefined, { ${SPAWN} });`,
    );
    expect(result.warnings).toHaveLength(1);
  });

  it("a file it can't parse, naming the file", async () => {
    const result = await rewrite(`${header}const App = () => <div />;`, {
      from: "/app/src/App.jsx?t=1",
    });
    expect(result.code).toBeNull();
    expect(result.warnings).toEqual([
      { message: expect.stringContaining("could not parse /app/src/App.jsx,") },
    ]);
  });
});

// The plugin returns no source map (so the package needs no dependencies):
// it tells the bundler the code kept its lines. That only holds if no edit
// adds or removes a line break.
describe("line numbers", () => {
  /** The line each `// @N` marker is on, by N. */
  function markerLines(code) {
    const lines = code.split(/\r\n|[\n\r\u2028\u2029]/);
    return Object.fromEntries(
      lines.flatMap((line, i) =>
        [...line.matchAll(/\/\/ @(\d+)/g)].map((m) => [m[1], i + 1]),
      ),
    );
  }

  // Markers sit outside the function that is replaced, since its comments go
  // with it.
  it.for([
    [
      "a function body over several lines",
      `// @1
createWorkerPool(() => {
  return import("./worker");
}); // @2
const after = 1; // @3`,
    ],
    [
      "a function expression over several lines, with a config",
      `createWorkerPool(function () {
  // removed with the function
  return import(
    "./worker"
  );
}, { // @1
  workers: 2, // @2
}); // @3
// @4`,
    ],
    [
      "a config in a variable, over several lines",
      `createWorkerPool( // @1
  () =>
    import("./worker"),
  config, // @2
); // @3`,
    ],
    [
      "several calls",
      `const a = createWorkerPool(() => {
  return import("./worker");
}); // @1
const b = createWorkerPool(() => import("./worker")); // @2
const c = createWorkerPool(async () =>
  import("./worker"), {}); // @3
const d = 3; // @4`,
    ],
    [
      "Windows line breaks",
      `createWorkerPool(() => {\r\n  return import("./worker");\r\n}); // @1\r\nconst after = 1; // @2`,
    ],
  ])("stay the same with %s", async ([, body]) => {
    const source = header + body;
    const { code } = await rewrite(source);

    expect(code).not.toContain("import(");
    expect(Object.keys(markerLines(source)).length).toBeGreaterThan(1);
    expect(markerLines(code)).toEqual(markerLines(source));
  });

  it("a multi-line call still runs a pool with spawn", async () => {
    const { code } = await rewrite(
      `${header}createWorkerPool(() => {\n  return import("./worker");\n}, {\n  workers: 2,\n});`,
    );
    const [args, ...more] = poolCalls(code);

    expect(more).toEqual([]);
    expect(args[0]).toBeUndefined();
    expect(args[1]).toEqual({ workers: 2, spawn: expect.any(Function) });
    expect(spawned(args)).toEqual(WORKER);
  });
});
