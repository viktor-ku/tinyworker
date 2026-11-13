import z from "zod";

// Imported by the app (App.tsx) and by the worker (worker.ts). A module that
// both sides share is the ordinary case, and it is safe because the worker is
// built as a bundle of its own: see `spawn` in App.tsx.
export const numberToDouble = z.number().int();
