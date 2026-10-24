const MANIFEST_PATHS = [".claude-plugin/marketplace.json", ".github/plugin/marketplace.json"];
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const MAX_MANIFEST_LENGTH = 1_000_000;

export function parseRepository(value) {
  let repository = value.trim();
  if (/^https?:\/\//i.test(repository)) {
    let url;
    try {
      url = new URL(repository);
    } catch {
      throw new Error("Enter a GitHub repository as owner/repository or https://github.com/owner/repository.");
    }
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash) {
      throw new Error("Use a public github.com repository URL without credentials, query parameters, or fragments.");
    }
    repository = url.pathname.slice(1);
  }
  repository = repository.replace(/\/$/, "").replace(/\.git$/, "");
  const parts = repository.split("/");
  if (parts.length !== 2 || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(parts[0]) ||
      !/^[a-zA-Z0-9._-]{1,100}$/.test(parts[1]) || parts[1] === "." || parts[1] === "..") {
    throw new Error("Enter a repository as owner/repository, or its GitHub URL (not a file or folder URL).");
  }
  return parts.join("/");
}

export function parseManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
      typeof manifest.name !== "string" || !NAME_PATTERN.test(manifest.name)) {
    throw new Error("The marketplace manifest must contain a valid marketplace name.");
  }
  if (!Array.isArray(manifest.plugins)) {
    throw new Error("The marketplace manifest must contain a plugins array.");
  }
  const names = new Set();
  const plugins = manifest.plugins.map((plugin, index) => {
    if (!plugin || typeof plugin.name !== "string" || !NAME_PATTERN.test(plugin.name)) {
      throw new Error(`Plugin ${index + 1} has a missing or invalid name in the marketplace manifest.`);
    }
    if (names.has(plugin.name)) {
      throw new Error(`The marketplace manifest contains the duplicate plugin name "${plugin.name}".`);
    }
    names.add(plugin.name);
    return {
      name: plugin.name,
      description: typeof plugin.description === "string" ? plugin.description.slice(0, 2000) : "No description provided by this marketplace.",
    };
  });
  return { name: manifest.name, plugins };
}

async function readJSON(response) {
  const text = await response.text();
  if (text.length > MAX_MANIFEST_LENGTH) {
    throw new Error("GitHub returned a manifest that is too large (maximum 1 MB).");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("GitHub returned invalid JSON. Check the repository's marketplace manifest.");
  }
}

function responseError(response, context) {
  if (response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")) {
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    const retryAfter = Number(response.headers.get("retry-after"));
    const retryAt = reset > 0 ? reset * 1000 : retryAfter > 0 ? Date.now() + retryAfter * 1000 : Date.now() + 60000;
    const error = new Error(`GitHub's public request rate limit was reached. Try again after ${new Date(retryAt).toLocaleTimeString()}.`);
    error.retryAt = retryAt;
    return error;
  }
  if (response.status === 403) {
    return new Error("GitHub denied access to this repository. It must be public and available without signing in.");
  }
  if (response.status === 404) {
    return new Error("Repository not found. Check the owner and repository name, and make sure it is public.");
  }
  return new Error(`${context} (HTTP ${response.status}). Please try again later.`);
}

export async function discoverMarketplace(value, { fetchImpl = fetch, signal } = {}) {
  const repository = parseRepository(value);
  const metadataResponse = await fetchImpl(`https://api.github.com/repos/${repository}`, {
    signal, headers: { Accept: "application/vnd.github+json" },
  });
  if (!metadataResponse.ok) throw responseError(metadataResponse, "Could not read the GitHub repository");
  const metadata = await readJSON(metadataResponse);
  if (typeof metadata.default_branch !== "string" || !metadata.default_branch) {
    throw new Error("GitHub did not return the repository's default branch.");
  }
  for (const path of MANIFEST_PATHS) {
    const url = `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(metadata.default_branch)}/${path}`;
    const response = await fetchImpl(url, { signal });
    if (response.status === 404) continue;
    if (!response.ok) throw responseError(response, "Could not load the marketplace manifest");
    return {
      ...parseManifest(await readJSON(response)), repository, manifestURL: url,
      description: typeof metadata.description === "string" ? metadata.description.slice(0, 300) : "",
      stars: Number(metadata.stargazers_count) || 0,
    };
  }
  throw new Error(`No marketplace manifest found on the default branch. Expected ${MANIFEST_PATHS.join(" or ")}.`);
}

export function launchLink(path, values) {
  const query = Object.entries(values).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  return `https://github.com/copilot/app/launch?open=${encodeURIComponent(`ghapp://${path}?${query}`)}`;
}

export const SESSION_REPOSITORY = "apiarya/run-in-copilot";

export function pluginLinks(repository, marketplace, plugin) {
  const source = parseRepository(repository);
  if (!NAME_PATTERN.test(marketplace) || !NAME_PATTERN.test(plugin)) throw new Error("Select a valid marketplace plugin.");
  const pluginID = `${plugin}@${marketplace}`;
  const prompt = `Use the ${pluginID} plugin. What can you do?`;
  return {
    marketplace: launchLink("plugins/marketplace/add", { source }),
    plugin: launchLink("plugins/install", { source: pluginID }),
    session: launchLink("session/new", { repo: SESSION_REPOSITORY, mode: "interactive", prompt }),
    prompt,
  };
}


export function searchQueries(term) {
  const words = term.replace(/[^\w.\s-]+/g, " ").replace(/\s+/g, " ").trim();
  const queries = [words, `${words} plugin`];
  if (/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(words)) queries.splice(1, 0, `user:${words}`);
  return queries;
}

async function searchRepositories(query, fetchImpl, signal, limit) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", String(limit));
  const response = await fetchImpl(url.href, { signal, headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw responseError(response, "Could not search GitHub");
  const result = await readJSON(response);
  return Array.isArray(result.items) ? result.items : [];
}

function matchesText(text, term) {
  const words = term.toLowerCase().split(/[^\w]+/).filter(Boolean);
  const haystack = text.toLowerCase();
  return words.length > 0 && words.every((word) => haystack.includes(word));
}

export function matchesTerm(plugin, term) {
  return matchesText(`${plugin.name} ${plugin.description}`, term);
}

export function marketplaceMatchesTerm(marketplace, term) {
  return matchesText(`${marketplace.name} ${marketplace.repository}`, term);
}

async function readManifest(item, fetchImpl, signal) {
  const repository = item.full_name;
  for (const path of MANIFEST_PATHS) {
    const url = `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(item.default_branch)}/${path}`;
    const response = await fetchImpl(url, { signal });
    if (response.status === 404) continue;
    if (!response.ok) return null;
    try {
      return {
        ...parseManifest(await readJSON(response)), repository, manifestURL: url,
        description: typeof item.description === "string" ? item.description.slice(0, 300) : "",
        stars: Number(item.stargazers_count) || 0,
      };
    } catch {
      return null;
    }
  }
  return null;
}

export async function findMarketplaces(term, { fetchImpl = fetch, signal, limit = 50 } = {}) {
  if (term.includes("/")) {
    return [await discoverMarketplace(term, { fetchImpl, signal })];
  }
  if (!term.trim()) throw new Error("Type a word to search for, such as security or postgres.");
  const searches = await Promise.allSettled(searchQueries(term).map((query) => searchRepositories(query, fetchImpl, signal, limit)));
  if (searches.every((search) => search.status === "rejected")) throw searches.find((search) => search.reason?.retryAt)?.reason ?? searches[0].reason;
  const seen = new Set();
  const items = searches.flatMap((search) => search.status === "fulfilled" ? search.value : []).filter((item) => {
    if (typeof item?.full_name !== "string" || item.private || typeof item.default_branch !== "string" || !item.default_branch) return false;
    const key = item.full_name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const found = await Promise.all(items.map((item) => readManifest(item, fetchImpl, signal).catch((error) => {
    if (error.name === "AbortError") throw error;
    return null;
  })));
  return found.filter((marketplace) => marketplace && marketplace.plugins.length > 0);
}
