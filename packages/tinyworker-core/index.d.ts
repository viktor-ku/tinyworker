import type z from "zod";

type Config<I, O> = {
  input?: I extends z.ZodType ? I : void;
  output?: O extends z.ZodVoid ? undefined : O;
};

export function createWorkerFn(): {
  handler(workload: () => void | Promise<void>): () => Promise<void>;
};

export function createWorkerFn<I = z.ZodAny, O = z.ZodVoid>(
  config: Config<I, O>,
): {
  handler(
    workload: (input: z.input<I>) => z.infer<O> | Promise<z.infer<O>>,
  ): (input: z.input<I>) => Promise<z.infer<O>>;
};

type PoolConfig = {
  /** How many workers the pool runs. Defaults to 2. */
  workers?: number;
  /**
   * Creates one worker; the pool calls it once for each worker it runs.
   *
   * Write the `new Worker(new URL(..., import.meta.url))` expression out in
   * full, right here: that is the form a bundler such as Vite recognises and
   * builds as a separate worker bundle.
   *
   * ```ts
   * const pool = createWorkerPool(() => import("./worker"), {
   *   spawn: () =>
   *     new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
   * });
   * ```
   *
   * With `spawn`, the first argument only gives the pool its type. It is never
   * called.
   *
   * Without `spawn`, the pool reads the worker URL out of the first argument's
   * source text. A bundler then builds the worker as a lazy chunk of the app,
   * which does not run in a worker, so always pass `spawn` in an app that is
   * built for production.
   */
  spawn?: (() => Worker) | undefined;
};

/**
 * Creates a pool of workers that all run the module `mod` imports, and returns
 * an object with that module's functions; calling one runs it in a worker.
 *
 * @param mod `() => import("./worker")`. Gives the pool its type.
 */
export function createWorkerPool<T>(
  mod: () => T,
  config?: PoolConfig,
): Awaited<ReturnType<typeof mod>>;
