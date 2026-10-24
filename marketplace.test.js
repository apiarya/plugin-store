import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { discoverMarketplace, findMarketplaces, launchLink, marketplaceMatchesTerm, matchesTerm, parseManifest, parseRepository, pluginLinks, searchQueries } from "./marketplace.js";

const example = {
  name: "life-sciences",
  plugins: [{ name: "clinical-trial-protocol", description: "Develop clinical trial protocols.", skills: ["./clinical-trial-protocol-skill"] }],
};
const jsonResponse = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });

function mockGitHub(responses) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    assert.ok(responses.length, `Unexpected request: ${url}`);
    return responses.shift();
  };
  return { requests, fetchImpl };
}

test("normalizes supported repository inputs", () => {
  for (const value of ["anthropics/life-sciences", " anthropics/life-sciences ", "https://github.com/anthropics/life-sciences", "https://github.com/anthropics/life-sciences/", "https://github.com/anthropics/life-sciences.git"]) {
    assert.equal(parseRepository(value), "anthropics/life-sciences");
  }
  assert.equal(parseRepository("microsoft/work-iq"), "microsoft/work-iq");
});

test("rejects ambiguous, unsafe, and non-GitHub repository inputs", () => {
  for (const value of ["", "owner", "/owner/repo", "owner/repo/tree/main", "owner/..", "owner/.", "-owner/repo", "owner-/repo", "owner/repo?ref=main", "https://example.com/owner/repo", "http://github.com/owner/repo", "https://github.com:8080/owner/repo", "https://user:password@github.com/owner/repo", "https://github.com/owner/repo?q=x", "https://github.com/owner/repo#section", "javascript:alert(1)", "owner/repo%2fextra", "<script>/repo"]) {
    assert.throws(() => parseRepository(value), Error, value);
  }
});

test("reads actual marketplace and plugin names and supports skill-only plugins", () => {
  assert.deepEqual(parseManifest(example), {
    name: "life-sciences",
    plugins: [{ name: "clinical-trial-protocol", description: "Develop clinical trial protocols." }],
  });
  assert.equal(parseManifest({ name: "manifest-not-repo", plugins: [{ name: "actual-plugin" }] }).plugins[0].name, "actual-plugin");
  assert.deepEqual(parseManifest({ name: "empty", plugins: [] }), { name: "empty", plugins: [] });
});

test("rejects invalid manifest structure and ambiguous identifiers", () => {
  for (const manifest of [null, [], {}, { name: "../bad", plugins: [] }, { name: "valid" }, { name: "valid", plugins: {} }, { name: "valid", plugins: [null] }, { name: "valid", plugins: [{ name: "bad@name" }] }, { name: "valid", plugins: [{ name: "one" }, { name: "one" }] }]) {
    assert.throws(() => parseManifest(manifest));
  }
});

test("keeps untrusted descriptions as text and bounds their length", () => {
  const unsafe = '<img src=x onerror="alert(1)">';
  assert.equal(parseManifest({ name: "safe", plugins: [{ name: "one", description: unsafe }] }).plugins[0].description, unsafe);
  assert.equal(parseManifest({ name: "safe", plugins: [{ name: "one", description: "x".repeat(3000) }] }).plugins[0].description.length, 2000);
  assert.match(parseManifest({ name: "safe", plugins: [{ name: "one", description: {} }] }).plugins[0].description, /No description/);
});

test("discovers a manifest on the actual default branch", async () => {
  const mock = mockGitHub([jsonResponse({ default_branch: "release/v2" }), jsonResponse(example)]);
  const controller = new AbortController();
  const result = await discoverMarketplace("anthropics/life-sciences", { fetchImpl: mock.fetchImpl, signal: controller.signal });
  assert.equal(result.name, "life-sciences");
  assert.equal(result.repository, "anthropics/life-sciences");
  assert.equal(result.manifestURL, "https://raw.githubusercontent.com/anthropics/life-sciences/release%2Fv2/.claude-plugin/marketplace.json");
  assert.equal(mock.requests[0].url, "https://api.github.com/repos/anthropics/life-sciences");
  assert.ok(mock.requests.every(({ options }) => options.signal === controller.signal));
});

test("falls back to the GitHub plugin manifest path only when the first path is absent", async () => {
  const mock = mockGitHub([
    jsonResponse({ default_branch: "main" }),
    jsonResponse({}, 404),
    jsonResponse({ name: "work-iq", plugins: [{ name: "workiq" }] }),
  ]);
  const result = await discoverMarketplace("microsoft/work-iq", { fetchImpl: mock.fetchImpl });
  assert.equal(result.plugins[0].name, "workiq");
  assert.match(result.manifestURL, /\.github\/plugin\/marketplace\.json$/);
  assert.equal(mock.requests.length, 3);
});

test("shows missing manifest paths and missing public repositories explicitly", async () => {
  const absent = mockGitHub([jsonResponse({ default_branch: "main" }), jsonResponse({}, 404), jsonResponse({}, 404)]);
  await assert.rejects(discoverMarketplace("owner/repo", { fetchImpl: absent.fetchImpl }), /No marketplace manifest found.*\.claude-plugin.*\.github\/plugin/);
  const missing = mockGitHub([jsonResponse({}, 404)]);
  await assert.rejects(discoverMarketplace("owner/repo", { fetchImpl: missing.fetchImpl }), /Repository not found/);
});

test("surfaces rate limits, access failures, server failures, and invalid JSON", async () => {
  for (const [response, expected] of [
    [jsonResponse({}, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "2000000000" }), /rate limit.*Try again after/],
    [jsonResponse({}, 429), /rate limit/],
    [jsonResponse({}, 403), /denied access/],
    [jsonResponse({}, 500), /HTTP 500/],
    [new Response("<html>not JSON</html>"), /invalid JSON/],
    [jsonResponse({}), /default branch/],
  ]) {
    const mock = mockGitHub([response]);
    await assert.rejects(discoverMarketplace("owner/repo", { fetchImpl: mock.fetchImpl }), expected);
  }
});

test("does not hide invalid or inaccessible first manifests behind a fallback", async () => {
  for (const response of [new Response("{broken"), jsonResponse({ name: "bad" }), jsonResponse({}, 503)]) {
    const mock = mockGitHub([jsonResponse({ default_branch: "main" }), response]);
    await assert.rejects(discoverMarketplace("owner/repo", { fetchImpl: mock.fetchImpl }));
    assert.equal(mock.requests.length, 2);
  }
});

test("rejects oversized responses and propagates network and abort failures", async () => {
  const huge = mockGitHub([jsonResponse({ default_branch: "main" }), new Response(" ".repeat(1_000_001))]);
  await assert.rejects(discoverMarketplace("owner/repo", { fetchImpl: huge.fetchImpl }), /too large/);
  for (const error of [new TypeError("Failed to fetch"), new DOMException("Aborted", "AbortError")]) {
    await assert.rejects(discoverMarketplace("owner/repo", { fetchImpl: async () => { throw error; } }), (actual) => actual === error);
  }
});

test("invalid input never makes a network request", async () => {
  await assert.rejects(discoverMarketplace("not-a-repository", {
    fetchImpl: async () => assert.fail("Should not fetch"),
  }));
});

test("double-encodes marketplace and plugin links according to the documented wrapper", () => {
  const links = pluginLinks("anthropics/life-sciences", "life-sciences", "clinical-trial-protocol");
  assert.equal(links.marketplace, "https://github.com/copilot/app/launch?open=ghapp%3A%2F%2Fplugins%2Fmarketplace%2Fadd%3Fsource%3Danthropics%252Flife-sciences");
  assert.equal(links.plugin, "https://github.com/copilot/app/launch?open=ghapp%3A%2F%2Fplugins%2Finstall%3Fsource%3Dclinical-trial-protocol%2540life-sciences");
  assert.equal(links.session, null);
  const workiq = pluginLinks("microsoft/work-iq", "work-iq", "workiq");
  assert.equal(new URL(new URL(workiq.plugin).searchParams.get("open")).searchParams.get("source"), "workiq@work-iq");
});

test("session links require a separate target and contain only documented parameters", () => {
  const links = pluginLinks("anthropics/life-sciences", "life-sciences", "clinical-trial-protocol", "apiarya/my-project");
  const appLink = new URL(new URL(links.session).searchParams.get("open"));
  assert.equal(appLink.protocol, "ghapp:");
  assert.equal(appLink.hostname, "session");
  assert.equal(appLink.pathname, "/new");
  assert.deepEqual([...appLink.searchParams.keys()], ["repo", "mode", "prompt"]);
  assert.equal(appLink.searchParams.get("repo"), "apiarya/my-project");
  assert.equal(appLink.searchParams.get("mode"), "interactive");
  assert.equal(appLink.searchParams.get("prompt"), "Use the clinical-trial-protocol@life-sciences plugin. What can you do?");
  assert.throws(() => pluginLinks("owner/repo", "valid", "plugin", "bad"));
  assert.throws(() => pluginLinks("owner/repo", "invalid@marketplace", "plugin"));
});

test("query values round-trip special characters without adding parameters", () => {
  const prompt = "What can you do? & = # / +";
  const link = new URL(new URL(launchLink("session/new", { repo: "owner/repo", prompt })).searchParams.get("open"));
  assert.equal(link.searchParams.get("prompt"), prompt);
  assert.deepEqual([...link.searchParams.keys()], ["repo", "prompt"]);
});

test("page has accessible labels, initially disabled links, no prefilled target, and safe rendering", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("./app.js", import.meta.url), "utf8");
  for (const id of ["search-term", "target-repo"]) {
    assert.ok(html.includes(`for="${id}"`));
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.match(html, /<div id="result-options" class="result-list" role="radiogroup"/);
  assert.match(html, /role="status" aria-live="polite"/);
  const targetInput = html.match(/<input id="target-repo"[^>]*>/)[0];
  assert.ok(!targetInput.includes("value="));
  assert.equal((html.match(/aria-disabled="true" tabindex="-1"/g) ?? []).length, 3);
  assert.ok(!script.includes("innerHTML"));
  assert.ok(!script.includes("eval("));
  assert.match(script, /text\.textContent = description/);
  assert.match(html, /<noscript>/);
});

test("search queries and plugin matching", () => {
  assert.deepEqual(searchQueries("postgres"), ["postgres", "user:postgres", "postgres plugin"]);
  assert.deepEqual(searchQueries('a:b "c"'), ["a b c", "a b c plugin"]);
  assert.ok(matchesTerm({ name: "pg-tools", description: "Postgres helpers" }, "postgres"));
  assert.ok(!matchesTerm({ name: "pg-tools", description: "Postgres helpers" }, "mysql"));
  assert.ok(!matchesTerm({ name: "x", description: "y" }, ""));
  assert.ok(marketplaceMatchesTerm({ name: "tools", repository: "acme/postgres-kit" }, "postgres"));
  assert.ok(marketplaceMatchesTerm({ name: "postgres-hub", repository: "acme/kit" }, "Postgres"));
  assert.ok(!marketplaceMatchesTerm({ name: "tools", repository: "acme/kit" }, "postgres"));
});

test("findMarketplaces keeps only repositories with valid manifests in GitHub order", async () => {
  const requests = [];
  const manifests = {
    "a/one/main/.claude-plugin/marketplace.json": { name: "one", plugins: [{ name: "lint" }] },
    "b/two/trunk/.github/plugin/marketplace.json": { name: "two", plugins: [{ name: "pg", description: "Postgres tools" }] },
    "c/bad/main/.claude-plugin/marketplace.json": { nope: true },
    "f/postgres-hub/main/.claude-plugin/marketplace.json": { name: "hub", plugins: [{ name: "misc" }] },
    "g/tagged/main/.claude-plugin/marketplace.json": { name: "tagged", plugins: [{ name: "other" }] },
  };
  const results = await findMarketplaces("postgres", {
    fetchImpl: async (url) => {
      requests.push(url);
      if (url.startsWith("https://api.github.com/search/repositories")) {
        const query = new URL(url).searchParams.get("q");
        if (query === "user:postgres") return jsonResponse({ message: "Validation Failed" }, 422);
        if (query === "postgres plugin") {
          return jsonResponse({ items: [
            { full_name: "B/Two", default_branch: "trunk", stargazers_count: 3 },
            { full_name: "g/tagged", default_branch: "main", stargazers_count: 50 },
          ] });
        }
        assert.equal(query, "postgres");
        assert.equal(new URL(url).searchParams.get("sort"), null);
        return jsonResponse({ items: [
          { full_name: "a/one", default_branch: "main", stargazers_count: 9, description: "First" },
          { full_name: "b/two", default_branch: "trunk", stargazers_count: 3 },
          { full_name: "c/bad", default_branch: "main" },
          { full_name: "d/none", default_branch: "main" },
          { full_name: "e/private", default_branch: "main", private: true },
          { full_name: "f/postgres-hub", default_branch: "main", stargazers_count: 1 },
        ] });
      }
      const key = url.replace("https://raw.githubusercontent.com/", "");
      return key in manifests ? jsonResponse(manifests[key]) : jsonResponse({}, 404);
    },
  });
  assert.deepEqual(results.map((item) => [item.repository, item.name, item.stars]), [["a/one", "one", 9], ["b/two", "two", 3], ["f/postgres-hub", "hub", 1], ["g/tagged", "tagged", 50]]);
  assert.equal(results[0].description, "First");
  assert.equal(requests.filter((url) => url.includes("raw.githubusercontent.com/B/Two")).length, 0);
  assert.ok(!requests.some((url) => url.includes("e/private")));
  await assert.rejects(findMarketplaces("x", { fetchImpl: async () => jsonResponse({}, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "2000000000" }) }), (error) => /rate limit/.test(error.message) && error.retryAt === 2000000000000);
  await assert.rejects(findMarketplaces("x", { fetchImpl: async () => jsonResponse({}, 429, { "retry-after": "30" }) }), (error) => error.retryAt > Date.now() + 25000);
  const partial = await findMarketplaces("x", {
    fetchImpl: async (url) => {
      if (url.includes("q=x+plugin")) return jsonResponse({}, 403, { "x-ratelimit-remaining": "0" });
      if (url.startsWith("https://api.github.com/")) return jsonResponse({ items: [{ full_name: "a/one", default_branch: "main" }] });
      return jsonResponse({ name: "one", plugins: [{ name: "p" }] });
    },
  });
  assert.deepEqual(partial.map((item) => item.repository), ["a/one"]);
  await assert.rejects(findMarketplaces("   "), /Type a word/);
});
