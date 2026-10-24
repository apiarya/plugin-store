import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { ANALYTICS_HOST, MEASUREMENT_ID, createAnalytics } from "./analytics.js";

function fakePage(hostname) {
  const appended = [];
  const win = { location: { hostname } };
  const doc = { createElement: (tag) => ({ tag }), head: { append: (element) => appended.push(element) } };
  return { win, doc, appended };
}

test("analytics loads Google Analytics only on the published site", () => {
  const local = fakePage("localhost");
  const off = createAnalytics(local);
  assert.equal(off.enabled, false);
  off.track("search", { search_term: "x" });
  assert.equal(local.win.dataLayer, undefined);
  assert.deepEqual(local.appended, []);

  const live = fakePage(ANALYTICS_HOST);
  const on = createAnalytics(live);
  assert.equal(on.enabled, true);
  assert.equal(live.appended[0].src, `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`);
  assert.equal(live.appended[0].async, true);
  assert.deepEqual([...live.win.dataLayer[1]], ["config", MEASUREMENT_ID]);
  on.track("install_plugin", { plugin_name: "azure" });
  assert.deepEqual([...live.win.dataLayer.at(-1)], ["event", "install_plugin", { plugin_name: "azure" }]);
});

test("the content security policy allows only the Google Analytics origins it needs", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const policy = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(policy, /script-src 'self' https:\/\/www\.googletagmanager\.com;/);
  assert.match(policy, /connect-src [^;]*https:\/\/\*\.google-analytics\.com/);
  assert.doesNotMatch(policy, /'unsafe-inline'|'unsafe-eval'/);
});

test("the Pages workflow deploys every local module the pages import", async () => {
  const { readdir } = await import("node:fs/promises");
  const workflows = await readdir(new URL("./.github/workflows/", import.meta.url));
  const workflow = (await Promise.all(workflows.map((name) => readFile(new URL(`./.github/workflows/${name}`, import.meta.url), "utf8")))).join("\n");
  const deployed = new Set(workflow.match(/cp ([^\n]+) _site\//)[1].split(/\s+/));
  const pending = ["index.html", "launch.html"];
  for (const file of pending) {
    assert.ok(deployed.has(file), `${file} is not deployed`);
    const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
    for (const [, dependency] of source.matchAll(/(?:src|href|from)\s*=?\s*"\.\/([\w.-]+\.(?:js|css|svg))"/g)) {
      assert.ok(deployed.has(dependency), `${dependency} (used by ${file}) is not deployed`);
      if (dependency.endsWith(".js") && !pending.includes(dependency)) pending.push(dependency);
    }
  }
});
