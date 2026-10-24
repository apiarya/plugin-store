import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseRepository } from "./marketplace.js";
import { categories, marketplaces, marketplaceURL, rankedMarketplaces, snapshotDate } from "./catalog.js";
import { createMarketplaceCard, initializeStorefront } from "./storefront.js";

test("catalog snapshot uses relative days with its exact date available on hover", (t) => {
  const originalDocument = globalThis.document;
  const date = {};
  const sections = { replaceChildren() {}, append() {} };
  globalThis.document = {
    getElementById: (id) => id === "catalog-date" ? date : id === "marketplace-sections" ? sections : {},
    querySelectorAll: () => [],
    createElement: () => ({
      dataset: {}, append() {}, setAttribute() {}, addEventListener() {},
    }),
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  let now = Date.parse(snapshotDate);
  t.mock.method(Date, "now", () => now);
  for (const [days, expected] of [[0, "today"], [1, "1 day ago"], [5, "5 days ago"], [30, "1 month ago"]]) {
    now = Date.parse(snapshotDate) + days * 86_400_000 + 12 * 3_600_000;
    initializeStorefront(() => {});
    assert.equal(date.textContent, expected);
    assert.equal(date.dateTime, snapshotDate);
    assert.equal(date.title, "Oct 24, 2026");
  }
});

test("storefront has five categories with branded Coding, Productivity, and Data & AI rows", () => {
  assert.equal(categories.length, 5);
  assert.equal(marketplaces.length, 34);
  assert.equal(new Set(categories.map(({ id }) => id)).size, 5);
  assert.equal(new Set(marketplaces.map(({ repository }) => repository.toLowerCase())).size, marketplaces.length);
  for (const category of categories) {
    assert.ok(category.label);
    assert.equal(rankedMarketplaces(category.id).length, ({ coding: 7, productivity: 7, "data-ai": 14 })[category.id] ?? 3, category.label);
  }
  assert.ok(marketplaces.every(({ category }) => categories.some(({ id }) => id === category)));
});

test("curated marketplaces have numeric star snapshots and supported manifest provenance", () => {
  assert.match(snapshotDate, /^\d{4}-\d{2}-\d{2}$/);
  for (const marketplace of marketplaces) {
    assert.equal(parseRepository(marketplace.repository), marketplace.repository);
    assert.ok(marketplace.name && marketplace.description);
    assert.ok(Number.isSafeInteger(marketplace.stars) && marketplace.stars > 0);
    assert.ok(Number.isSafeInteger(marketplace.pluginCount) && marketplace.pluginCount > 0);
    const manifest = new URL(marketplace.manifestURL);
    assert.equal(manifest.origin, "https://raw.githubusercontent.com");
    assert.ok(manifest.pathname.startsWith(`/${marketplace.repository}/`));
    assert.match(manifest.pathname, /\/\.(claude-plugin|github\/plugin)\/marketplace\.json$/);
  }
});

test("Coding, Productivity, and Data & AI keep their curated order and other categories rank by stars without mutating the catalog", () => {
  const original = [...marketplaces];
  for (const { id } of categories) {
    const ranked = rankedMarketplaces(id);
    assert.equal(ranked.length, marketplaces.filter(({ category }) => category === id).length);
    if (id === "coding") {
      assert.deepEqual(ranked.map(({ repository }) => repository), [
        "vercel/next.js", "anthropics/claude-code", "microsoft/skills", "oracle/skills",
        "stripe/ai", "github/awesome-copilot", "obra/superpowers",
      ]);
      continue;
    }
    if (id === "data-ai") {
      assert.deepEqual(ranked.map(({ repository }) => repository), [
        "huggingface/diffusers", "microsoft/azure-skills", "anthropics/financial-services-plugins",
        "supabase/agent-skills", "langchain-ai/langchain-skills", "anthropics/skills", "huggingface/skills",
        "firebase/firebase-tools", "dbt-labs/dbt-agent-skills", "duckdb/duckdb-skills", "elastic/agent-skills",
        "ClickHouse/agent-skills", "databricks/databricks-agent-skills", "mongodb/agent-skills",
      ]);
      continue;
    }
    if (id === "productivity") {
      assert.deepEqual(ranked.map(({ repository }) => repository), [
        "microsoft/work-iq", "anthropics/knowledge-work-plugins", "makenotion/claude-code-notion-plugin",
        "OthmanAdi/planning-with-files", "atlassian/atlassian-mcp-server", "github/copilot-plugins", "miroapp/miro-ai",
      ]);
      continue;
    }
    for (let i = 1; i < ranked.length; i++) {
      assert.ok(ranked[i - 1].stars >= ranked[i].stars);
    }
  }
  assert.deepEqual(marketplaces, original);
});

test("category cards enter the existing search page with an exact marketplace selection", () => {
  for (const { repository } of marketplaces) {
    const link = new URL(marketplaceURL(repository), "https://apiarya.github.io/plugin-store/index.html");
    assert.equal(link.pathname, "/plugin-store/");
    assert.equal(link.searchParams.get("q"), repository);
    assert.equal(link.searchParams.get("select"), repository);
    assert.deepEqual([...link.searchParams.keys()], ["q", "select"]);
  }
  assert.throws(() => marketplaceURL("https://example.com/untrusted"));
});

test("homepage examples distinguish runnable searches from plugin deep links", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const examples = html.match(/<div class="search-examples">([\s\S]*?)<\/nav>/)[1];
  assert.match(examples, /aria-label="Search examples"/);
  for (const [kind, query] of [["keyword", "database"], ["owner", "vercel"], ["repository", "oracle/skills"]]) {
    assert.ok(examples.includes(`type="button" data-search-example="${query}" aria-label="Search ${kind}: ${query}"`));
  }
  const links = [...examples.matchAll(/<a href="([^"]+)"/g)];
  assert.equal(links.length, 3);
  for (const [index, [repository, plugin]] of [
    ["oracle/skills", "db"], ["vercel/next.js", "nextjs"], ["huggingface/diffusers", "diffusers"],
  ].entries()) {
    for (const base of ["http://localhost:8000/", "https://apiarya.github.io/plugin-store/"]) {
      const url = new URL(links[index][1].replaceAll("&amp;", "&"), base);
      assert.equal(url.origin, new URL(base).origin);
      assert.equal(url.pathname, new URL(base).pathname);
      assert.equal(url.searchParams.get("q"), repository);
      assert.equal(url.searchParams.get("select"), repository);
      assert.equal(url.searchParams.get("plugin"), plugin);
    }
  }
});

test("storefront and search share one page without a separate install dialog or hero", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("./index.html", import.meta.url), "utf8"),
    readFile(new URL("./storefront.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /<form id="search-form" role="search">/);
  assert.match(html, /id="storefront"/);
  assert.match(html, /id="results"/);
  assert.doesNotMatch(html, /<dialog|class="hero"/);
  assert.doesNotMatch(script, /pluginLinks|showModal/);
  for (const { id, label } of categories) {
    assert.ok(html.includes(`data-category="${id}"`), label);
  }
});

test("marketplace tiles use real publisher avatars with no letter-icon fallback", async () => {
  const publisherIDs = {
    obra: 45416, wshobson: 553618, github: 9919, anthropics: 76263028,
    othmanadi: 78882424, microsoft: 6154722, trailofbits: 2314423,
    getsentry: 1396951, "k-dense-ai": 238572432,
    vercel: 14985020, oracle: 4430336, stripe: 856813,
    makenotion: 4792552, atlassian: 168166, miroapp: 48276018,
    huggingface: 25720743, firebase: 1335026, supabase: 54469796, "langchain-ai": 126733545,
    "dbt-labs": 18339788, duckdb: 82039556, elastic: 6764390, clickhouse: 54801242, databricks: 4998052, mongodb: 45120,
  };
  for (const { repository, avatarURL } of marketplaces) {
    const avatar = new URL(avatarURL);
    assert.equal(avatar.origin, "https://avatars.githubusercontent.com");
    assert.equal(avatar.pathname, `/u/${publisherIDs[repository.split("/")[0].toLowerCase()]}`);
    assert.equal(avatar.searchParams.get("s"), "96");
  }
  const script = await readFile(new URL("./storefront.js", import.meta.url), "utf8");
  assert.match(script, /createElement\("img"\)/);
  assert.match(script, /avatar\.src = pick\.avatarURL/);
  assert.match(script, /avatar\.referrerPolicy = "no-referrer"/);
  assert.doesNotMatch(script, /monogram|app-icon/);
});

test("selected marketplace has an accessible product view with the shared plugin chooser and actions", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  assert.match(html, /<section id="marketplace-product"[^>]*aria-labelledby="product-title" hidden>/);
  assert.match(html, /<h1 id="product-title"><\/h1>/);
  assert.match(html, /id="product-avatar"/);
  assert.match(html, /id="back-to-results"/);
  assert.doesNotMatch(html, /id="product-browse-all"/);
  for (const id of ["search-form", "actions", "marketplace-browser", "marketplace-launch", "plugin-launch", "session-launch"]) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `Expected one shared ${id}`);
  }
});

test("plugin sharing is discoverable and separate from the three installation steps", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  assert.match(html, /id="copy-plugin-link"[^>]*aria-label="Share plugin"[^>]*title="Copy plugin link"[^>]*disabled>/);
  assert.doesNotMatch(html, /plugin-share-hint/);
  assert.match(html, /id="plugin-share-status"[^>]*role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(html, /id="plugin-share-controls" class="plugin-share-controls" hidden>/);
  const actionRow = html.match(/<div class="action-row">([\s\S]*?)<\/div>/)[1];
  assert.equal((actionRow.match(/class="launch-button"/g) ?? []).length, 3);
  assert.doesNotMatch(actionRow, /copy-plugin-link/);
  assert.doesNotMatch(actionRow, /copy-marketplace-link/);
  assert.match(html, /id="copy-marketplace-link"[^>]*aria-label="Share marketplace"[^>]*aria-describedby="marketplace-share-hint"[^>]*disabled>/);
  assert.match(html, /id="marketplace-share-hint"[^>]*>Share this marketplace so others can browse its plugins\.<\/p>/);
  assert.match(html, /id="marketplace-share-status"[^>]*role="status" aria-live="polite" aria-atomic="true"/);
  assert.equal((html.match(/class="share-icon" aria-hidden="true"/g) ?? []).length, 2);
  assert.equal((html.match(/class="share-label">Share<\/span>/g) ?? []).length, 2);
});

test("featured and search cards share rendering, safe text, metadata, and selection behavior", (t) => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag) => ({
      tagName: tag.toUpperCase(), children: [], dataset: {}, attributes: {}, events: {},
      append(...children) { this.children.push(...children); },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, handler) { this.events[name] = handler; },
      set innerHTML(value) { assert.fail(`Unexpected HTML rendering: ${value}`); },
    }),
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  const nodes = (node) => [node, ...node.children.flatMap(nodes)];
  const find = (card, className) => nodes(card).find((node) => node.className === className);
  const featured = marketplaces[0];
  const search = {
    ...featured, name: "actual-manifest", description: "<img src=x onerror=alert(1)>",
    plugins: [{ name: "one" }], topics: ["testing"], pushedAt: "2026-10-20T12:00:00Z",
  };
  const selections = [];
  for (const pick of [featured, search]) {
    const card = createMarketplaceCard(pick, (repository) => selections.push(repository));
    assert.equal(card.className, "marketplace-card");
    assert.equal(card.href, marketplaceURL(pick.repository));
    assert.equal(find(card, "card-name").textContent, pick.name);
    assert.equal(find(card, "card-description").textContent, pick.description);
    assert.equal(find(card, "marketplace-avatar").src, pick.avatarURL);
    assert.equal(find(card, "marketplace-avatar").referrerPolicy, "no-referrer");
    const count = pick.plugins?.length ?? pick.pluginCount;
    assert.equal(find(card, "card-count").textContent, `${count} ${count === 1 ? "plugin" : "plugins"}`);
    if (pick.topics) assert.equal(find(card, "topic-tag").textContent, "testing");
    if (pick.pushedAt) assert.equal(find(card, "last-push").dateTime, pick.pushedAt);
    let prevented = false;
    card.events.click({ button: 0, preventDefault() { prevented = true; } });
    assert.ok(prevented);
    card.events.click({ button: 0, ctrlKey: true, preventDefault() { assert.fail("Modified click must keep native navigation"); } });
  }
  assert.deepEqual(selections, [featured.repository, search.repository]);
  const noAvatar = createMarketplaceCard({ ...search, avatarURL: "" }, () => {});
  assert.equal(find(noAvatar, "marketplace-avatar"), undefined);
});
