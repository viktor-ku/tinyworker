export function extractUrl(str) {
  const [_, firstPart] = str.split('import("');
  const [rawUrl] = firstPart.split('"');

  const pathname = new URL(rawUrl, import.meta.url).pathname;
  return new URL(pathname, import.meta.url);
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
