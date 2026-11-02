// The demo shows pool.double(2) in an <h1>, so a working app shows "4".
// The dev server is the control: it shows whether the test itself works.
import { expect, test } from "@playwright/test";

const targets = [
  { name: "dev server", url: "http://localhost:5181/" },
  { name: "production build", url: "http://localhost:5182/" },
];

for (const target of targets) {
  test(`${target.name}: the demo doubles 2 to 4`, async ({ page }) => {
    // Uncaught errors from the page and from its dedicated workers.
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(target.url);

    await expect.soft(page.locator("h1")).toHaveText("4", { timeout: 3000 });
    expect.soft(errors, "uncaught errors in the page or its workers").toEqual([]);
  });
}
