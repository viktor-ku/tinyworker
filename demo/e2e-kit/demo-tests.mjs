// The tests every demo has to pass, however it is served. All demos render
// the same page: an <h1> with pool.double(n), and a number input for n that
// starts at 2.
//
// Each demo's spec passes in `test` and `expect` from its own
// @playwright/test.

/** Uncaught errors from the page and from its dedicated workers. */
function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** URLs of the dedicated workers that are running right now. */
function trackWorkers(page) {
  const urls = new Map();
  page.on("worker", (worker) => {
    urls.set(worker, worker.url());
    worker.on("close", () => urls.delete(worker));
  });
  return () => [...urls.values()];
}

const fileName = (url) => new URL(url).pathname.split("/").pop();

export function defineDemoTests({ test, expect, targets }) {
  for (const target of targets) {
    test.describe(target.name, () => {
      test("doubles the starting number, then a typed one", async ({ page }) => {
        const errors = collectErrors(page);

        await page.goto(target.url);
        await expect(page.locator("h1")).toHaveText("4");

        const input = page.getByPlaceholder("Number to double");
        await input.fill("21");
        await input.blur();
        await expect(page.locator("h1")).toHaveText("42");

        expect(errors, "uncaught errors in the page or its workers").toEqual([]);
      });

      test("runs two workers, each from a script that never loads the app", async ({
        page,
      }) => {
        const errors = collectErrors(page);
        const workerUrls = trackWorkers(page);

        await page.goto(target.url);

        // 2 is the pool's default size.
        await expect.poll(() => workerUrls().length).toBe(2);

        // The scripts index.html loads: the app's entry. Leave out the dev
        // server's own client.
        const appScripts = (
          await page
            .locator('script[type="module"][src]')
            .evaluateAll((scripts) => scripts.map((it) => it.src))
        ).filter((src) => !src.includes("/@vite/"));
        expect(appScripts, "app entry scripts").not.toEqual([]);

        // A worker that imports the app's entry runs the whole app, which
        // needs `document`, and dies (#1).
        for (const url of new Set(workerUrls())) {
          expect(appScripts, "the worker is not the app").not.toContain(url);

          const response = await page.request.get(url);
          expect(response.ok(), `GET ${url}`).toBe(true);
          const source = await response.text();

          for (const appScript of appScripts) {
            expect(
              source.includes(fileName(appScript)),
              `worker script ${fileName(url)} refers to the app entry ${fileName(appScript)}`,
            ).toBe(false);
          }
        }

        // And the workers it checked are alive: they answer.
        await expect(page.locator("h1")).toHaveText("4");
        expect(errors, "uncaught errors in the page or its workers").toEqual([]);
      });
    });
  }
}
