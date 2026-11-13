import { createWorkerPool } from "@tinyworker/core";
import { createResource, createSignal } from "solid-js";

// `spawn` is what makes a production build work: the bundler sees
// `new Worker(new URL(...))` and builds worker.ts as a bundle of its own.
// The import() only gives `pool` its type; it is never called.
const pool = createWorkerPool(() => import("./worker.js"), {
  spawn: () =>
    new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
});

export function App() {
  const [num, setNum] = createSignal(2);
  const [data] = createResource(num, (it) => pool.double(it));

  return (
    <div>
      <h1>{data()}</h1>
      <input
        type="number"
        placeholder="Number to double"
        value={num()}
        onChange={(e) => {
          setNum(parseInt(e.currentTarget.value, 10));
        }}
      />
    </div>
  );
}
