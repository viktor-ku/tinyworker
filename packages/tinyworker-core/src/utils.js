export function extractUrl(str) {
  const [_, firstPart] = str.split('import("');
  const [rawUrl] = firstPart.split('"');

  const pathname = new URL(rawUrl, import.meta.url).pathname;
  return new URL(pathname, import.meta.url);
}

/**
 * True for anything that can be driven like a dedicated worker. Duck-typed, not
 * `instanceof Worker`, so workers from another realm (an iframe) and wrapped
 * workers count too.
 */
export function isWorkerLike(it) {
  return (
    typeof it === "object" &&
    it !== null &&
    typeof it.postMessage === "function" &&
    typeof it.addEventListener === "function" &&
    typeof it.terminate === "function"
  );
}

/** Names a value's type for an error message. */
export function typeName(it) {
  if (it === null) {
    return "null";
  }

  if (typeof it === "object") {
    return it.constructor?.name ?? "object";
  }

  return typeof it;
}

export function sleep(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

export function createId() {
  return Date.now() - Math.floor(Math.random() * 1e8);
}

export function isMainThread() {
  return typeof window !== "undefined";
}

export function assertOnWorker(error) {
  if (isMainThread()) {
    throw new Error(error);
  }
}

export function throwAway() {
  throw new Error("Should not be reachable");
}

export function assert(expr, error) {
  if (!expr) {
    throw new Error(error);
  }
}
