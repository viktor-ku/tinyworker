import "./global.css";
import { createWorkerPool } from "@tinyworker/core";

// No framework and no TypeScript: plain JavaScript and the DOM.
//
// `spawn` is what makes a production build work: the bundler sees
// `new Worker(new URL(...))` and builds worker.js as a bundle of its own.
// The import() is never called. In plain JavaScript it still tells the editor
// what `pool` can do.
const pool = createWorkerPool(() => import("./worker.js"), {
  spawn: () =>
    new Worker(new URL("./worker.js", import.meta.url), { type: "module" }),
});

const heading = document.querySelector("h1");
const input = document.querySelector("input");

let latest = 0;

async function update() {
  const num = input.valueAsNumber;

  if (Number.isNaN(num)) {
    return;
  }

  latest += 1;
  const mine = latest;
  const doubled = await pool.double(num);

  // An older call may finish after a newer one. Only show the newest.
  if (mine === latest) {
    heading.textContent = String(doubled);
  }
}

input.addEventListener("change", update);
update();
