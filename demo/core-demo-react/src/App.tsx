import { createWorkerPool } from "@tinyworker/core";
import { useEffect, useState } from "react";
import { numberToDouble } from "./schema";

// `spawn` is what makes a production build work: the bundler sees
// `new Worker(new URL(...))` and builds worker.ts as a bundle of its own.
// The import() only gives `pool` its type; it is never called.
const pool = createWorkerPool(() => import("./worker"), {
  spawn: () =>
    new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
});

export function App() {
  const [text, setText] = useState("2");
  const [doubled, setDoubled] = useState<number>();

  // An empty field is not 0: Number("") would say it is.
  const parsed = numberToDouble.safeParse(text.trim() === "" ? NaN : Number(text));
  const num = parsed.success ? parsed.data : undefined;

  useEffect(() => {
    if (num === undefined) {
      return;
    }

    let stale = false;

    pool.double(num).then((it) => {
      if (!stale) {
        setDoubled(it);
      }
    });

    return () => {
      stale = true;
    };
  }, [num]);

  return (
    <div>
      <h1>{doubled}</h1>
      <input
        type="number"
        placeholder="Number to double"
        value={text}
        onChange={(e) => {
          setText(e.currentTarget.value);
        }}
      />
    </div>
  );
}
