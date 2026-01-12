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
  workers?: number;
};

export function createWorkerPool<T>(
  mod: () => T,
  config?: PoolConfig,
): Awaited<ReturnType<typeof mod>>;
