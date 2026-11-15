import "./global.css";
import { createWorkerPool } from "@tinyworker/core";

// No framework and no TypeScript: plain JavaScript and the DOM.
//
// The tinyworker() plugin in vite.config.js builds worker.js as a bundle of
// its own, so this works in a production build too.
const pool = createWorkerPool(() => import("./worker.js"));

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
