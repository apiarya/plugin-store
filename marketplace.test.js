import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { discoverMarketplace, findMarketplaces, formatRelativeTime, launchLink, marketplaceMatchesTerm, marketplaceResults, matchesTerm, parseManifest, parseRepository, pluginLinks, searchQueries } from "./marketplace.js";

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
    plugins: [{ name: "clinical-trial-protocol", description: "Develop clinical trial protocols.", version: "" }],
  });
  assert.equal(parseManifest({ name: "manifest-not-repo", plugins: [{ name: "actual-plugin" }] }).plugins[0].name, "actual-plugin");
  assert.deepEqual(parseManifest({ name: "empty", plugins: [] }), { name: "empty", plugins: [] });
});

test("rejects invalid manifest structure and ambiguous identifiers", () => {
  for (const manifest of [null, [], {}, { name: "../bad", plugins: [] }, { name: "valid" }, { name: "valid", plugins: {} }, { name: "valid", plugins: [null] }, { name: "valid", plugins: [{ name: "bad@name" }] }, { name: "valid", plugins: [{ name: "one" }, { name: "one" }] }]) {
    assert.throws(() => parseManifest(manifest));
  }
});

test("reads only plugin versions, omitting missing or invalid values and bounding text", () => {
  for (const [version, expected] of [
    [" 1.2.3 ", "1.2.3"], ["v2.0.0-beta.1", "v2.0.0-beta.1"],
    [undefined, ""], [null, ""], [12, ""], [{}, ""], ["   ", ""],
    ["x".repeat(101), "x".repeat(100)], ["<img src=x>", "<img src=x>"],
  ]) {
    const manifest = parseManifest({
      name: "tools", metadata: { version: "9.0.0" }, plugins: [{ name: "lint", version }],
    });
    assert.equal(manifest.plugins[0].version, expected);
  }
});

test("keeps untrusted descriptions as text and bounds their length", () => {
  const unsafe = '<img src=x onerror="alert(1)">';
  assert.equal(parseManifest({ name: "safe", plugins: [{ name: "one", description: unsafe }] }).plugins[0].description, unsafe);
  assert.equal(parseManifest({ name: "safe", plugins: [{ name: "one", description: "x".repeat(3000) }] }).plugins[0].description.length, 2000);
  assert.match(parseManifest({ name: "safe", plugins: [{ name: "one", description: {} }] }).plugins[0].description, /No description/);
});

test("discovers a manifest on the actual default branch", async () => {
  const mock = mockGitHub([jsonResponse({
    default_branch: "release/v2",
    pushed_at: "2026-10-20T12:30:00Z",
    topics: ["science", "research", "skills", "extra"],
    owner: { avatar_url: "https://avatars.githubusercontent.com/u/123?v=4" },
  }), jsonResponse(example)]);
  const controller = new AbortController();
  const result = await discoverMarketplace("anthropics/life-sciences", { fetchImpl: mock.fetchImpl, signal: controller.signal });
  assert.equal(result.name, "life-sciences");
  assert.equal(result.repository, "anthropics/life-sciences");
  assert.equal(result.manifestURL, "https://raw.githubusercontent.com/anthropics/life-sciences/release%2Fv2/.claude-plugin/marketplace.json");
  assert.equal(result.pushedAt, "2026-10-20T12:30:00Z");
  assert.deepEqual(result.topics, ["science", "research", "skills"]);
  assert.equal(result.avatarURL, "https://avatars.githubusercontent.com/u/123?v=4");
  assert.equal(mock.requests[0].url, "https://api.github.com/repos/anthropics/life-sciences");
  assert.ok(mock.requests.every(({ options }) => options.signal === controller.signal));
});

test("last-push timestamps use relative time with exact unit boundaries", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  for (const [elapsed, expected] of [
    [0, "just now"],
    [59_999, "just now"],
    [60_000, "1 minute ago"],
    [3_599_999, "59 minutes ago"],
    [3_600_000, "1 hour ago"],
    [86_399_999, "23 hours ago"],
    [86_400_000, "1 day ago"],
    [2 * 86_400_000, "2 days ago"],
    [29 * 86_400_000, "29 days ago"],
    [30 * 86_400_000, "1 month ago"],
    [365 * 86_400_000, "1 year ago"],
    [2 * 365 * 86_400_000, "2 years ago"],
    [-2 * 86_400_000, "in 2 days"],
  ]) {
    assert.equal(formatRelativeTime(new Date(now - elapsed).toISOString(), now), expected);
  }
  assert.throws(() => formatRelativeTime("not-a-date", now), RangeError);
});

test("optional repository metadata is omitted when absent or invalid", async () => {
  for (const metadata of [
    {},
    { pushed_at: "not-a-date", topics: "not-an-array", owner: { avatar_url: "https://avatars.githubusercontent.com.example.org/avatar" } },
    { pushed_at: null, topics: [null, "", " ", 12], owner: { avatar_url: "javascript:alert(1)" } },
  ]) {
    const mock = mockGitHub([jsonResponse({ default_branch: "main", ...metadata }), jsonResponse(example)]);
    const result = await discoverMarketplace("anthropics/life-sciences", { fetchImpl: mock.fetchImpl });
    assert.equal(result.pushedAt, "");
    assert.deepEqual(result.topics, []);
    assert.equal(result.avatarURL, "");
  }
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
  assert.ok(links.session);
  const workiq = pluginLinks("microsoft/work-iq", "work-iq", "workiq");
  assert.equal(new URL(new URL(workiq.plugin).searchParams.get("open")).searchParams.get("source"), "workiq@work-iq");
});

test("session links open in the hello-world example repository with only documented parameters", () => {
  const links = pluginLinks("anthropics/life-sciences", "life-sciences", "clinical-trial-protocol");
  const appLink = new URL(new URL(links.session).searchParams.get("open"));
  assert.equal(appLink.protocol, "ghapp:");
  assert.equal(appLink.hostname, "session");
  assert.equal(appLink.pathname, "/new");
  assert.deepEqual([...appLink.searchParams.keys()], ["repo", "mode", "prompt"]);
  assert.equal(appLink.searchParams.get("repo"), "apiarya/hello-world-example");
  assert.equal(appLink.searchParams.get("mode"), "interactive");
  assert.equal(appLink.searchParams.get("prompt"), "Use the clinical-trial-protocol@life-sciences plugin. What can you do?");
  assert.throws(() => pluginLinks("owner/repo", "invalid@marketplace", "plugin"));
});

test("query values round-trip special characters without adding parameters", () => {
  const prompt = "What can you do? & = # / +";
  const link = new URL(new URL(launchLink("session/new", { repo: "owner/repo", prompt })).searchParams.get("open"));
  assert.equal(link.searchParams.get("prompt"), prompt);
  assert.deepEqual([...link.searchParams.keys()], ["repo", "prompt"]);
});

test("page has accessible labels, initially disabled links, and safe rendering", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const cards = await readFile(new URL("./storefront.js", import.meta.url), "utf8");
  for (const id of ["search-term"]) {
    assert.ok(html.includes(`for="${id}"`));
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.match(html, /<div id="result-options" class="marketplace-grid result-list" role="list"/);
  assert.match(html, /role="list" aria-label="Marketplaces"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /for="search-term">Find your next plugin<\/label>/);
  assert.match(html, /placeholder="Repository, owner, or keyword"/);
  assert.doesNotMatch(html, /search-guidance|Popular marketplaces, grouped by what you want to do/);
  assert.match(html, /class="catalog-note">Curated marketplaces &middot; Snapshot: <time id="catalog-date">/);
  assert.match(html, /class="search-icon" aria-hidden="true"/);
  assert.match(html, /<h2 id="marketplace-summary">Choose a plugin<\/h2>/);
  assert.ok(!html.includes('id="selected-plugin"'));
  assert.ok(!html.includes('id="selected-plugin-description"'));
  assert.ok(!html.includes("target-repo"));
  assert.equal((html.match(/aria-disabled="true" tabindex="-1"/g) ?? []).length, 3);
  assert.ok(!script.includes("innerHTML"));
  assert.ok(!script.includes("eval("));
  assert.match(cards, /node\.textContent = text/);
  assert.ok(!cards.includes("innerHTML"));
  assert.match(html, /<noscript>/);
  const helper = await readFile(new URL("./launch.js", import.meta.url), "utf8");
  assert.match(helper, /open\.startsWith\("ghapp:\/\/"\)/);
  assert.ok(!helper.includes("innerHTML"));
});

test("branding and package metadata use Plugin Store", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const readme = await readFile(new URL("./README.md", import.meta.url), "utf8");
  const packageJSON = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));
  assert.match(html, /<title>Plugin Store — Discover what your agent can do<\/title>/);
  assert.match(html, /aria-label="Plugin Store home"/);
  assert.match(html, /class="brand-name">Plugin <span>Store<\/span>/);
  assert.match(html, /<h1 id="discover-title">Discover plugins<\/h1>/);
  assert.equal(packageJSON.name, "plugin-store");
  assert.match(readme, /^# Plugin Store\n/);
  assert.match(readme, /https:\/\/apiarya\.github\.io\/plugin-store\//);
  for (const content of [html, readme]) assert.doesNotMatch(content, /run-in-copilot|Run in Copilot/);
});

test("Pages deployment includes the launch handoff and its dependencies", async () => {
  const workflow = await readFile(new URL("./.github/workflows/pages.yml", import.meta.url), "utf8");
  const copy = workflow.match(/^\s*cp (.+) _site\/\s*$/m);
  assert.ok(copy, "Expected a static site asset copy step");
  const assets = copy[1].split(/\s+/);
  for (const asset of ["index.html", "launch.html", "styles.css", "app.js", "launch.js", "marketplace.js", "catalog.js", "storefront.js", "icon.svg"]) {
    assert.ok(assets.includes(asset), `Missing deployment asset: ${asset}`);
    await readFile(new URL(`./${asset}`, import.meta.url));
  }
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

test("marketplace results group plugins by source and prioritize matching groups", () => {
  const first = { name: "shared", repository: "a/tools", plugins: [{ name: "lint", description: "" }] };
  const matching = { name: "shared", repository: "b/tools", plugins: [
    { name: "other", description: "" },
    { name: "pg", description: "Postgres helpers" },
    { name: "postgres-test", description: "" },
  ] };
  const last = { name: "last", repository: "c/tools", plugins: [{ name: "format", description: "" }] };
  const empty = { name: "empty", repository: "d/tools", plugins: [] };
  const results = marketplaceResults([first, matching, last, empty], "postgres");
  assert.equal(results.length, 3);
  assert.deepEqual(results.map(({ marketplace }) => marketplace.repository), ["b/tools", "a/tools", "c/tools"]);
  assert.equal(results[0].plugin.name, "pg");
  assert.equal(results[0].marketplace.plugins.length, 3);
  assert.equal(results[1].plugin.name, "lint");
  assert.equal(matching.plugins[0].name, "other");
  assert.deepEqual(marketplaceResults([], "postgres"), []);
  assert.deepEqual(marketplaceResults([empty], "postgres"), []);
  assert.deepEqual(marketplaceResults([first, matching], "").map(({ marketplace }) => marketplace.repository), ["a/tools", "b/tools"]);
});

test("most-stars sorting orders all groups by stars, retaining relevance for ties", () => {
  const create = (repository, stars, name = "other") => ({
    repository, name: repository, stars, plugins: [{ name, description: "" }],
  });
  const marketplaces = [
    create("a/match", 186, "spec-driven-workflow"),
    create("b/popular", 4303),
    create("c/tie", 186),
    create("d/unknown"),
    create("e/zero", 0),
  ];
  const stars = marketplaceResults(marketplaces, "spec-driven-workflow", "stars");
  assert.deepEqual(stars.map(({ marketplace }) => marketplace.repository), ["b/popular", "a/match", "c/tie", "d/unknown", "e/zero"]);
  assert.equal(stars[1].plugin.name, "spec-driven-workflow");
  assert.equal(marketplaceResults(marketplaces, "spec-driven-workflow")[0].marketplace.repository, "a/match");
  assert.equal(marketplaces[0].repository, "a/match");
  const many = Array.from({ length: 25 }, (_, index) => create(`owner/repo-${index}`, index));
  assert.equal(marketplaceResults(many, "", "stars")[0].marketplace.stars, 24);
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
          { full_name: "a/one", default_branch: "main", stargazers_count: 9, description: "First", pushed_at: "2026-10-21T00:00:00Z", topics: ["postgres", "tools"], owner: { avatar_url: "https://avatars.githubusercontent.com/u/456" } },
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
  assert.equal(results[0].pushedAt, "2026-10-21T00:00:00Z");
  assert.deepEqual(results[0].topics, ["postgres", "tools"]);
  assert.equal(results[0].avatarURL, "https://avatars.githubusercontent.com/u/456");
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
  const withKnown = await findMarketplaces("x", {
    known: [{ full_name: "known/market", default_branch: "main", stargazers_count: 5 }],
    fetchImpl: async (url) => url.includes("search/repositories")
      ? jsonResponse({ items: [] })
      : url.startsWith("https://raw.githubusercontent.com/known/market/main/.claude-plugin/")
        ? jsonResponse({ name: "known", plugins: [{ name: "p", source: "./p" }] })
        : jsonResponse({}, 404),
  });
  assert.deepEqual(withKnown.map(({ repository, stars }) => [repository, stars]), [["known/market", 5]]);
  await assert.rejects(findMarketplaces("   "), /Type a word/);
});
