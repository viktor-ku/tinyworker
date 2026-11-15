import { createWorkerPool } from "@tinyworker/core";
import { useEffect, useState } from "react";
import { numberToDouble } from "./schema";

// The tinyworker() plugin in vite.config.ts builds worker.ts as a bundle of
// its own, so this works in a production build too.
const pool = createWorkerPool(() => import("./worker"));

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
