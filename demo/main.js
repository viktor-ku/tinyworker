import "./demo.css";
import { createWorkerPool } from "../src/lib.js";

const app = document.getElementById("app");
render();

const pool = createWorkerPool(() => import("./worker.js"), { workers: 8 });

const p = [];

for (let i = 0, len = 10; i < len; i += 1) {
  console.log("starting", i);
  const waiting = pool.double(i).then((result) => {
    console.log("done", i, result);
    return result;
  });
  p.push(waiting);
}

const all = await Promise.all(p);
console.log("all", all);

function render() {
  const arr = new Uint8Array(128);
  self.crypto.getRandomValues(arr);

  const items = [];

  for (const n of arr) {
    items.push(`<span>${n}</span>`);
  }

  const html = `
    <header class="title">Constantly updating the following with main thread JS</header>
    <div class="container">
      ${items.join("")}
    </div>
  `;

  app.innerHTML = html;
  //
  // setTimeout(() => {
  //   requestAnimationFrame(() => {
  //     render();
  //   });
  // }, 0);
}
