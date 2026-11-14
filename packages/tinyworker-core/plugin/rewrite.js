// Rewrites `createWorkerPool(() => import("./worker"), config)` so that the
// worker is created with `new Worker(new URL("./worker.ts", import.meta.url))`.
// That expression is the one bundlers recognise and build as a worker bundle of
// its own; a dynamic import() is built as a lazy chunk of the app instead, and
// that chunk loads the whole app when it is run as a worker (#1).
//
// Kept free of any bundler API so it can be tested on its own: `parse` and
// `resolve` come from the plugin context.
import path from "node:path";
import MagicString from "magic-string";

export const PACKAGE = "@tinyworker/core";
const POOL = "createWorkerPool";
const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

/**
 * @param {string} code JavaScript, after TypeScript and JSX are compiled away.
 * @param {object} options
 * @param {string} options.importer Id of the module `code` belongs to.
 * @param {(code: string) => any} options.parse Returns an ESTree Program.
 * @param {(specifier: string, importer: string) => Promise<string | null>} options.resolve
 *   Returns the file a specifier points to, or null when it can't be resolved.
 * @returns {Promise<null | { code: string | null, map: object | null, warnings: { message: string, pos?: number }[] }>}
 *   null when there is nothing to change and nothing to warn about; `code` is
 *   null when there are only warnings.
 */
export async function rewritePoolCalls(code, { importer, parse, resolve }) {
  if (!code.includes(PACKAGE) || !code.includes(POOL)) {
    return null;
  }

  let ast;
  try {
    ast = parse(code);
  } catch {
    return {
      code: null,
      map: null,
      warnings: [
        {
          message: `could not parse ${cleanId(importer)}, so its ${POOL} calls were not rewritten. List the tinyworker plugin after the plugins that compile this file.`,
        },
      ],
    };
  }

  const bindings = poolBindings(ast);
  if (bindings.names.size === 0 && bindings.namespaces.size === 0) {
    return null;
  }

  const calls = [];
  walk(ast, (node) => {
    if (node.type === "CallExpression" && isPoolCallee(node.callee, bindings)) {
      calls.push(node);
    }
  });

  const s = new MagicString(code);
  const warnings = [];
  let changed = false;

  for (const call of calls) {
    const args = call.arguments;

    if (args.some((it) => it.type === "SpreadElement")) {
      warnings.push(notRewritten(code, importer, call, "its arguments are spread"));
      continue;
    }

    const [mod, config] = args;

    // The caller creates the workers; nothing to do.
    if (config?.type === "ObjectExpression" && hasKey(config, "spawn")) {
      continue;
    }

    const specifier = importSpecifier(mod);
    if (specifier === undefined) {
      warnings.push(
        notRewritten(
          code,
          importer,
          call,
          'its first argument is not written as `() => import("./worker")` with a fixed path',
        ),
      );
      continue;
    }

    const resolved = await resolve(specifier, importer);
    if (!resolved) {
      throw withPos(
        new Error(`${POOL}: cannot find the worker module "${specifier}"`),
        mod.start,
      );
    }

    const url = JSON.stringify(workerPath(importer, resolved, specifier));
    const spawn = `spawn: () => new Worker(new URL(${url}, import.meta.url), { type: "module" })`;

    // The import() would still be built into a lazy chunk nobody loads.
    s.overwrite(mod.start, mod.end, "undefined");

    if (config === undefined) {
      // Before the call's own ")", not after `mod`: a parser that drops
      // parentheses ends `mod` inside `((...))`, and "(undefined, {...})"
      // there would be one comma expression, not two arguments. Between `mod`
      // and that ")" there are only ")"s, comments and a trailing comma.
      const close = call.end - 1;
      const tail = code.slice(mod.end, close).replace(COMMENTS, "");
      s.appendLeft(close, `${tail.includes(",") ? " " : ", "}{ ${spawn} }`);
    } else if (config.type === "ObjectExpression") {
      // First, so a property the caller wrote still has the last word.
      s.appendRight(config.start + 1, ` ${spawn},`);
    } else {
      s.prependRight(config.start, `{ ${spawn}, ...(`);
      s.appendLeft(config.end, `) }`);
    }

    changed = true;
  }

  if (!changed && warnings.length === 0) {
    return null;
  }

  return {
    code: changed ? s.toString() : null,
    map: changed ? s.generateMap({ hires: "boundary", source: importer }) : null,
    warnings,
  };
}

/** The local names `createWorkerPool` is imported under, by name or namespace. */
function poolBindings(ast) {
  const names = new Set();
  const namespaces = new Set();

  for (const node of ast.body) {
    if (node.type !== "ImportDeclaration" || node.source.value !== PACKAGE) {
      continue;
    }

    for (const it of node.specifiers) {
      if (it.type === "ImportSpecifier" && keyName(it.imported) === POOL) {
        names.add(it.local.name);
      } else if (it.type === "ImportNamespaceSpecifier") {
        namespaces.add(it.local.name);
      }
    }
  }

  return { names, namespaces };
}

function isPoolCallee(callee, { names, namespaces }) {
  const node = unwrap(callee);

  if (node.type === "Identifier") {
    return names.has(node.name);
  }

  if (node.type === "MemberExpression" && node.object.type === "Identifier") {
    const key = node.computed
      ? node.property.type === "Literal" && node.property.value
      : node.property.name;

    return namespaces.has(node.object.name) && key === POOL;
  }

  return false;
}

/**
 * "./worker" for `() => import("./worker")` and the forms that mean the same:
 * a function expression, a block that only returns it, async, a template
 * literal without placeholders. undefined for anything else.
 */
function importSpecifier(node) {
  const fn = node && unwrap(node);

  if (
    !fn ||
    (fn.type !== "ArrowFunctionExpression" &&
      fn.type !== "FunctionExpression") ||
    fn.params.length !== 0 ||
    fn.generator
  ) {
    return undefined;
  }

  let body = fn.body;
  if (body.type === "BlockStatement") {
    if (body.body.length !== 1 || body.body[0].type !== "ReturnStatement") {
      return undefined;
    }
    body = body.body[0].argument;
  }

  body = body && unwrap(body);
  if (body?.type !== "ImportExpression") {
    return undefined;
  }

  const source = unwrap(body.source);
  if (source.type === "Literal" && typeof source.value === "string") {
    return source.value;
  }

  if (source.type === "TemplateLiteral" && source.expressions.length === 0) {
    return source.quasis[0].value.cooked ?? undefined;
  }

  return undefined;
}

/** The worker file, relative to the importer, as `new URL()` wants it. */
function workerPath(importer, resolved, specifier) {
  const file = cleanId(resolved);

  if (file.startsWith("\0") || !path.isAbsolute(file)) {
    throw new Error(
      `${POOL}: "${specifier}" resolves to "${resolved}", which is not a file`,
    );
  }

  const relative = path
    .relative(path.dirname(cleanId(importer)), file)
    .split(path.sep)
    .join("/");

  return relative.startsWith("../") ? relative : `./${relative}`;
}

function notRewritten(code, importer, call, reason) {
  // Not every bundler prints where a warning comes from, so the message says.
  const before = code.slice(0, call.start).split("\n");
  const where = `${cleanId(importer)}:${before.length}:${before.at(-1).length + 1}`;

  return {
    message: `the ${POOL} call at ${where} was not rewritten because ${reason}. Its workers will load the whole app in a production build; pass \`spawn\` to create them yourself.`,
    pos: call.start,
  };
}

function hasKey(object, key) {
  return object.properties.some(
    (it) => it.type === "Property" && !it.computed && keyName(it.key) === key,
  );
}

function keyName(node) {
  return node.type === "Identifier" ? node.name : node.value;
}

/** Parsers that keep parentheses wrap the expression in a node of its own. */
function unwrap(node) {
  let it = node;
  while (it.type === "ParenthesizedExpression") {
    it = it.expression;
  }
  return it;
}

function cleanId(id) {
  return id.replace(/[?#].*$/s, "");
}

function withPos(err, pos) {
  err.pos = pos;
  return err;
}

function walk(node, visit) {
  if (Array.isArray(node)) {
    for (const it of node) {
      walk(it, visit);
    }
    return;
  }

  if (node === null || typeof node !== "object" || typeof node.type !== "string") {
    return;
  }

  visit(node);

  for (const key in node) {
    const value = node[key];
    if (value !== null && typeof value === "object") {
      walk(value, visit);
    }
  }
}
