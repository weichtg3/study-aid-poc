import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("app shell uses one cache-busting version for assets, data, and service worker", async () => {
  const [app, html, serviceWorker] = await Promise.all([
    readFile("public/app.js", "utf8"),
    readFile("public/index.html", "utf8"),
    readFile("public/service-worker.js", "utf8")
  ]);
  const version = app.match(/const APP_VERSION = "([^"]+)"/)?.[1];
  assert.ok(version);
  assert.match(app, /fetch\(url, \{ cache: "no-store" \}\)/);
  assert.ok(html.includes(`styles.css?v=${version}`));
  assert.ok(html.includes(`app.js?v=${version}`));
  assert.ok(serviceWorker.includes(`const VERSION = "${version}"`));
  assert.ok(app.includes("service-worker.js?v=${APP_VERSION}"));
});

test("quiz shell exposes non-sequential navigation", async () => {
  const app = await readFile("public/app.js", "utf8");
  assert.match(app, /data-action="previous-question"/);
  assert.match(app, /id="question-jump"/);
  assert.match(app, /data-action="following-question"/);
  assert.match(app, /state\.answers\[state\.questionIndex\]/);
  assert.match(app, /state\.feedbacks\[index\]/);
});
