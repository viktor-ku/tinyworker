import { defineConfig, devices } from "@playwright/test";
import { demoPlaywrightConfig } from "../e2e-kit/playwright.mjs";
import { ports } from "./e2e/ports.js";

export default defineConfig(demoPlaywrightConfig({ devices, ports }));
