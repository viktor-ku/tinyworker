import { createWorkerPool } from "@tinyworker/core";
import { createResource, createSignal } from "solid-js";

const pool = createWorkerPool(() => import("./worker.js"), {});

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
