import { findMarketplaces, formatRelativeTime, marketplaceResults, pluginLinks } from "./marketplace.js";
import { createMarketplaceCard, initializeStorefront, topicTags } from "./storefront.js";
import { catalogRepositories } from "./catalog.js";
import { analytics } from "./analytics.js";

const PAGE_SIZE = 20;
const PLUGIN_PAGE_SIZE = 5;
const byID = (id) => document.getElementById(id);
const form = byID("search-form");
const term = byID("search-term");
const button = byID("search-button");
const resultsSection = byID("results");
const storefront = byID("storefront");
const product = byID("marketplace-product");
const status = byID("search-status");
const options = byID("result-options");
const more = byID("more-results");
const actions = byID("actions");
const marketplaceFilter = byID("marketplace-filter");
const marketplacePlugins = byID("marketplace-plugins");
const pluginShareControls = byID("plugin-share-controls");
const resultSort = byID("result-sort");
let foundMarketplaces = [];
let searchedTerm = "";
let results = [];
let activePlugin = null;
let activeMarketplace = null;
let filteredPlugins = [];
let pluginPage = 0;
let shown = 0;
let controller = null;
let retryTimer = null;
let launched = null;
let directSelection = false;
let restoringHistory = false;
const searchCache = new Map();
const LAUNCH_EVENTS = { "marketplace-launch": "add_marketplace", "plugin-launch": "install_plugin", "session-launch": "ask_plugin" };
const launchButtons = ["marketplace-launch", "plugin-launch", "session-launch"].map(byID);

function navigateURL(url, { replace = false, state = null } = {}) {
  const method = replace || url.href === window.location.href ? "replaceState" : "pushState";
  window.history[method](state, "", url);
}

function clearDone() {
  launchButtons.forEach((link) => {
    link.classList.remove("done", "next-step");
    link.removeAttribute("aria-current");
  });
}

function highlightStep(link = launchButtons[0]) {
  if (!link.href) return;
  launchButtons.forEach((button) => {
    button.classList.toggle("next-step", button === link);
    if (button === link) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
}

launchButtons.forEach((link) => {
  link.addEventListener("focus", () => highlightStep(link));
  link.addEventListener("click", (event) => {
    if (!link.href) return;
    highlightStep(link);
    const result = selected();
    analytics.track(LAUNCH_EVENTS[link.id], {
      marketplace_repository: result?.marketplace.repository ?? "",
      plugin_name: (activePlugin ?? result?.plugin)?.name ?? "",
    });
    const tab = window.open(link.href, "_blank");
    if (!tab) return;
    event.preventDefault();
    launched = { link, tab };
  });
});

function returned() {
  if (!launched || document.hidden || !document.hasFocus()) return;
  const { link, tab } = launched;
  launched = null;
  tab?.close();
  link.classList.remove("next-step");
  link.removeAttribute("aria-current");
  link.classList.add("done");
  launchButtons.slice(launchButtons.indexOf(link) + 1).find((next) => next.href)?.focus();
}
window.addEventListener("focus", returned);
document.addEventListener("visibilitychange", returned);

function setLink(id, href) {
  const link = byID(id);
  if (href) {
    link.href = `./launch.html?open=${encodeURIComponent(new URL(href).searchParams.get("open"))}`;
    link.target = "_blank";
    link.removeAttribute("aria-disabled");
    link.removeAttribute("tabindex");
  } else {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    link.setAttribute("tabindex", "-1");
  }
}

function cancelRetry() {
  clearInterval(retryTimer);
  retryTimer = null;
}

function scheduleRetry(retryAt) {
  const wait = Math.min(Math.max(retryAt - Date.now(), 1000), 300000);
  const end = Date.now() + wait;
  const tick = () => {
    const seconds = Math.ceil((end - Date.now()) / 1000);
    if (seconds <= 0) {
      cancelRetry();
      form.requestSubmit();
      return;
    }
    setStatus(`GitHub's search limit was reached. Retrying in ${seconds}s…`, "error");
  };
  retryTimer = setInterval(tick, 1000);
  tick();
}

function setStatus(message, kind = "") {
  status.className = `status ${kind}`.trim();
  status.textContent = message;
}

function option(marketplace) {
  const wrapper = document.createElement("div");
  wrapper.className = "result";
  wrapper.setAttribute("role", "listitem");
  wrapper.append(createMarketplaceCard(marketplace, () => selectMarketplace(marketplace)));
  return wrapper;
}

const selected = () => results.find(({ marketplace }) => marketplace === activeMarketplace);

const shareControls = ["marketplace", "plugin"].map((kind) => {
  const copyButton = byID(`copy-${kind}-link`);
  const label = copyButton.querySelector(".share-label");
  const feedback = byID(`${kind}-share-status`);
  let timer = null;
  let revision = 0;
  function reset() {
    clearTimeout(timer);
    revision++;
    label.textContent = "Share";
    copyButton.classList.remove("is-copied");
    copyButton.setAttribute("aria-label", `Share ${kind}`);
    copyButton.disabled = !selected();
    feedback.textContent = "";
    feedback.className = "status share-status";
  }
  copyButton.addEventListener("click", async () => {
    if (!selected()) return;
    reset();
    const currentRevision = revision;
    const url = new URL(window.location.href);
    if (kind === "marketplace") url.searchParams.delete("plugin");
    copyButton.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url.href);
      if (currentRevision !== revision) return;
      label.textContent = "Link copied";
      copyButton.classList.add("is-copied");
      copyButton.setAttribute("aria-label", kind === "marketplace" ? "Marketplace link copied" : "Plugin link copied");
      if (kind === "marketplace") feedback.textContent = "Marketplace link copied.";
      timer = setTimeout(reset, 2000);
    } catch {
      if (currentRevision !== revision) return;
      feedback.className = "status share-status error";
      feedback.textContent = "Could not copy the link. Select and copy the link below.";
      const fallback = document.createElement("a");
      fallback.href = url.href;
      fallback.textContent = url.href;
      feedback.append(document.createElement("br"), fallback);
    } finally {
      if (currentRevision === revision) copyButton.disabled = false;
    }
  });
  return { reset };
});

function showProduct(marketplace) {
  form.hidden = true;
  resultsSection.hidden = true;
  product.hidden = false;
  product.append(actions);
  actions.hidden = false;
  byID("back-to-results").hidden = directSelection;
  byID("back-to-results").parentElement.hidden = directSelection;
  byID("product-title").textContent = marketplace.name;
  const repository = byID("product-repository");
  repository.textContent = marketplace.repository;
  repository.href = `https://github.com/${marketplace.repository}`;
  const description = byID("product-description");
  description.textContent = marketplace.description;
  description.hidden = !marketplace.description;
  const avatar = byID("product-avatar");
  avatar.hidden = !marketplace.avatarURL;
  if (marketplace.avatarURL) avatar.src = marketplace.avatarURL;
  else avatar.removeAttribute("src");
  const count = marketplace.plugins.length;
  byID("product-plugin-count").textContent = `${count} ${count === 1 ? "plugin" : "plugins"}`;
  const stars = byID("product-stars");
  stars.hidden = !marketplace.stars;
  stars.textContent = marketplace.stars ? `★ ${marketplace.stars.toLocaleString()} GitHub stars` : "";
  const updated = byID("product-updated");
  updated.hidden = !marketplace.pushedAt;
  if (marketplace.pushedAt) {
    updated.dateTime = marketplace.pushedAt;
    updated.title = new Date(marketplace.pushedAt).toLocaleString();
    updated.textContent = `Last push ${formatRelativeTime(marketplace.pushedAt)}`;
  }
  byID("product-topics").replaceChildren(...topicTags(marketplace.topics));
}

function updateLinks() {
  shareControls.forEach((control) => control.reset());
  const result = selected();
  const plugin = activePlugin ?? result?.plugin;
  const links = result ? pluginLinks(result.marketplace.repository, result.marketplace.name, plugin.name) : null;
  setLink("marketplace-launch", links?.marketplace);
  setLink("plugin-launch", links?.plugin);
  setLink("session-launch", links?.session);
  byID("marketplace-launch-name").textContent = result?.marketplace.name ?? "";
  byID("plugin-launch-name").textContent = plugin?.name ?? "";
  byID("session-launch-name").textContent = plugin?.name ?? "";
  if (result) {
    byID("manifest-link").href = result.marketplace.manifestURL;
    byID("repository-link").href = `https://github.com/${result.marketplace.repository}`;
    const productURL = new URL(window.location.href);
    productURL.searchParams.set("q", result.marketplace.repository);
    productURL.searchParams.set("select", result.marketplace.repository);
    productURL.searchParams.set("plugin", plugin.name);
    window.history.replaceState(window.history.state, "", productURL);
  }
}

function filterMarketplace() {
  const marketplace = selected()?.marketplace;
  if (!marketplace) return;
  const query = marketplaceFilter.value.trim().toLowerCase();
  filteredPlugins = marketplace.plugins.filter((plugin) => `${plugin.name} ${plugin.description}`.toLowerCase().includes(query));
  pluginPage = 0;
  renderPluginPage();
}

function renderMarketplace() {
  const result = selected();
  marketplaceFilter.value = "";
  filteredPlugins = result?.marketplace.plugins ?? [];
  marketplaceFilter.hidden = filteredPlugins.length <= 1;
  for (const label of marketplaceFilter.labels) label.hidden = marketplaceFilter.hidden;
  const summary = byID("marketplace-summary");
  summary.classList.toggle("visually-hidden", marketplaceFilter.hidden);
  summary.textContent = marketplaceFilter.hidden ? "Plugin" : "Choose a plugin";
  const plugin = activePlugin ?? result?.plugin;
  pluginPage = Math.max(0, Math.floor(filteredPlugins.indexOf(plugin) / PLUGIN_PAGE_SIZE));
  renderPluginPage();
}

function renderPluginPage() {
  shareControls[1].reset();
  pluginShareControls.hidden = true;
  byID("marketplace-browser").append(pluginShareControls);
  marketplacePlugins.replaceChildren();
  const start = pluginPage * PLUGIN_PAGE_SIZE;
  const end = Math.min(start + PLUGIN_PAGE_SIZE, filteredPlugins.length);
  byID("plugin-pagination").hidden = filteredPlugins.length <= PLUGIN_PAGE_SIZE;
  byID("plugin-previous").disabled = pluginPage === 0;
  byID("plugin-next").disabled = end >= filteredPlugins.length;
  byID("plugin-page-status").textContent = filteredPlugins.length ? `${start + 1}-${end} of ${filteredPlugins.length}` : "";
  const marketplace = selected()?.marketplace;
  const query = marketplaceFilter.value.trim();
  byID("marketplace-count").textContent = !query || !marketplace ? "" : filteredPlugins.length
    ? `${filteredPlugins.length} of ${marketplace.plugins.length} ${marketplace.plugins.length === 1 ? "plugin" : "plugins"}`
    : "No matching plugins";
  for (const plugin of filteredPlugins.slice(start, end)) {
    const card = document.createElement("div");
    card.className = "plugin-choice-card";
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "marketplace-choice";
    choice.dataset.plugin = plugin.name;
    choice.title = plugin.description;
    const content = document.createElement("span");
    content.className = "choice-content";
    const name = document.createElement("strong");
    name.className = "choice-title";
    name.textContent = plugin.name;
    const heading = document.createElement("span");
    heading.className = "choice-heading";
    heading.append(name);
    if (plugin.version) {
      const version = document.createElement("span");
      version.className = "choice-version";
      version.textContent = plugin.version;
      version.setAttribute("aria-label", `Version ${plugin.version}`);
      heading.append(version);
    }
    const description = document.createElement("span");
    description.className = "choice-description";
    description.textContent = plugin.description || "No description provided by this marketplace.";
    content.append(heading, description);
    choice.append(content);
    choice.addEventListener("click", () => {
      activePlugin = plugin;
      byID("plugin-link-status").hidden = true;
      clearDone();
      updateLinks();
      updateMarketplaceSelection();
      highlightStep();
      byID("marketplace-launch").focus();
    });
    card.append(choice);
    marketplacePlugins.append(card);
  }
  updateMarketplaceSelection();
}

function updateMarketplaceSelection() {
  const plugin = activePlugin ?? selected()?.plugin;
  pluginShareControls.hidden = true;
  byID("marketplace-browser").append(pluginShareControls);
  for (const card of marketplacePlugins.children) {
    const choice = card.querySelector(".marketplace-choice");
    const checked = choice.dataset.plugin === plugin?.name;
    card.classList.toggle("selected", checked);
    choice.setAttribute("aria-pressed", String(checked));
    if (checked) {
      pluginShareControls.hidden = false;
      card.append(pluginShareControls);
    }
  }
}

function showMore() {
  results.slice(shown, shown + PAGE_SIZE).forEach(({ marketplace }) => {
    options.append(option(marketplace));
  });
  shown = Math.min(results.length, shown + PAGE_SIZE);
  more.hidden = shown >= results.length;
}

function render(marketplaces, searched) {
  product.hidden = true;
  form.hidden = false;
  foundMarketplaces = marketplaces;
  searchedTerm = searched;
  results = marketplaceResults(marketplaces, searched, resultSort.value);
  shown = 0;
  activePlugin = null;
  activeMarketplace = null;
  actions.hidden = true;
  document.body.append(actions);
  options.replaceChildren();
  clearDone();
  renderMarketplace();
  showMore();
  updateLinks();
}

form.querySelectorAll("[data-search-example]").forEach((example) => {
  example.addEventListener("click", () => {
    term.value = example.dataset.searchExample;
    form.requestSubmit();
    term.focus();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const restore = restoringHistory;
  const restoreState = restore ? window.history.state : null;
  cancelRetry();
  controller?.abort();
  const requestController = new AbortController();
  controller = requestController;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, 20000);
  const searched = term.value.trim();
  const searchURL = new URL(window.location.href);
  const requestedSelection = searchURL.searchParams.get("select")?.trim();
  const selectRepository = requestedSelection?.toLowerCase() === searched.toLowerCase() ? requestedSelection : null;
  const requestedPlugin = selectRepository ? searchURL.searchParams.get("plugin") : null;
  directSelection = Boolean(selectRepository) && !(restore && window.history.state?.returnSearch);
  if (!selectRepository) {
    searchURL.searchParams.delete("select");
    searchURL.searchParams.delete("plugin");
  }
  searchURL.searchParams.set("q", searched);
  navigateURL(searchURL, { replace: restore, state: restore ? window.history.state : null });
  document.body.classList.replace("home", "searched");
  storefront.hidden = true;
  resultsSection.hidden = false;
  render([], searched);
  button.disabled = true;
  form.setAttribute("aria-busy", "true");
  setStatus("Searching GitHub for plugin marketplaces…");
  try {
    const found = restore && searchCache.has(searched)
      ? searchCache.get(searched)
      : await findMarketplaces(searched, { signal: requestController.signal, known: catalogRepositories(searched) });
    if (controller !== requestController) return;
    searchCache.set(searched, found);
    render(found, searched);
    const restoredShown = Math.min(restoreState?.shown ?? 0, results.length);
    while (shown < restoredShown) showMore();
    const count = results.reduce((total, { marketplace }) => total + marketplace.plugins.length, 0);
    const marketplaceCount = results.length;
    if (!restore) analytics.track("search", { search_term: searched, results_count: marketplaceCount });
    setStatus(marketplaceCount
      ? `${marketplaceCount} ${marketplaceCount === 1 ? "marketplace" : "marketplaces"} · ${count} ${count === 1 ? "plugin" : "plugins"}`
      : "No marketplaces found.");
    if (selectRepository) {
      const result = results.find(({ marketplace }) => marketplace.repository.toLowerCase() === selectRepository.toLowerCase());
      if (result) selectMarketplace(result.marketplace, requestedPlugin, false);
    } else if (restoreState?.focusRepository) {
      options.querySelector(`[data-repository="${restoreState.focusRepository}"]`)?.focus();
    }
  } catch (error) {
    if (controller !== requestController) return;
    if (timedOut) setStatus("GitHub took too long to respond. Check your connection and try again.", "error");
    else if (error.retryAt) scheduleRetry(error.retryAt);
    else if (error instanceof TypeError) setStatus("Could not reach GitHub. Check your connection or browser network restrictions, then try again.", "error");
    else setStatus(error.message, "error");
  } finally {
    clearTimeout(timeout);
    if (controller === requestController) {
      controller = null;
      form.removeAttribute("aria-busy");
      button.disabled = false;
    }
  }
});

function selectMarketplace(marketplace, requestedPlugin = null, addHistory = true) {
  if (addHistory) {
    window.history.replaceState({ ...window.history.state, shown, focusRepository: marketplace.repository }, "", window.location.href);
    window.history.pushState({ returnSearch: directSelection ? null : searchedTerm }, "", window.location.href);
  }
  searchCache.set(marketplace.repository, [marketplace]);
  activeMarketplace = marketplace;
  activePlugin = requestedPlugin === null ? null : marketplace.plugins.find((plugin) => plugin.name === requestedPlugin) ?? null;
  const notice = byID("plugin-link-status");
  notice.hidden = requestedPlugin === null || Boolean(activePlugin);
  notice.textContent = notice.hidden ? "" : `The linked plugin "${requestedPlugin}" was not found in this marketplace. Choose a plugin below.`;
  clearDone();
  showProduct(marketplace);
  updateLinks();
  renderMarketplace();
  highlightStep();
  byID("marketplace-launch").focus();
}
more.addEventListener("click", showMore);
marketplaceFilter.addEventListener("input", filterMarketplace);
byID("plugin-previous").addEventListener("click", () => {
  pluginPage--;
  renderPluginPage();
});
byID("plugin-next").addEventListener("click", () => {
  pluginPage++;
  renderPluginPage();
});
resultSort.addEventListener("change", () => {
  results = marketplaceResults(foundMarketplaces, searchedTerm, resultSort.value);
  shown = 0;
  options.replaceChildren();
  showMore();
});

function showStorefront() {
  cancelRetry();
  controller?.abort();
  controller = null;
  button.disabled = false;
  form.removeAttribute("aria-busy");
  render([], "");
  setStatus("");
  resultsSection.hidden = true;
  storefront.hidden = false;
  document.body.classList.replace("searched", "home");
  term.value = "";
  const homeURL = new URL(window.location.href);
  homeURL.searchParams.delete("q");
  homeURL.searchParams.delete("select");
  homeURL.searchParams.delete("plugin");
  navigateURL(homeURL);
  term.focus();
}

byID("browse-all").addEventListener("click", showStorefront);
byID("back-to-results").addEventListener("click", () => {
  if (window.history.state?.returnSearch) {
    window.history.back();
    return;
  }
  const previousRepository = activeMarketplace?.repository;
  activeMarketplace = null;
  activePlugin = null;
  clearDone();
  updateLinks();
  actions.hidden = true;
  product.hidden = true;
  resultsSection.hidden = false;
  form.hidden = false;
  term.value = searchedTerm;
  const searchURL = new URL(window.location.href);
  searchURL.searchParams.set("q", searchedTerm);
  searchURL.searchParams.delete("select");
  searchURL.searchParams.delete("plugin");
  window.history.replaceState(null, "", searchURL);
  if (previousRepository) options.querySelector(`[data-repository="${previousRepository}"]`)?.focus();
});
byID("home-link").addEventListener("click", (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  showStorefront();
});

initializeStorefront((repository) => {
  term.value = repository;
  const searchURL = new URL(window.location.href);
  searchURL.searchParams.set("q", repository);
  searchURL.searchParams.set("select", repository);
  searchURL.searchParams.delete("plugin");
  navigateURL(searchURL);
  form.requestSubmit();
});

window.addEventListener("popstate", () => {
  const query = new URL(window.location.href).searchParams.get("q")?.trim();
  if (!query) {
    showStorefront();
    return;
  }
  term.value = query;
  restoringHistory = true;
  try {
    form.requestSubmit();
  } finally {
    restoringHistory = false;
  }
});

const initialSearch = new URLSearchParams(window.location.search).get("q")?.trim();
if (initialSearch) {
  term.value = initialSearch;
  form.requestSubmit();
}
