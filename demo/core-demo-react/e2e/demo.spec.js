// The checks all three demos share, on every way this one is served: see
// ../../e2e-kit/demo-tests.mjs.
import { expect, test } from "@playwright/test";
import { defineDemoTests } from "../../e2e-kit/demo-tests.mjs";
import { demoTargets } from "../../e2e-kit/playwright.mjs";
import { ports } from "./ports.js";

defineDemoTests({ test, expect, targets: demoTargets(ports) });
