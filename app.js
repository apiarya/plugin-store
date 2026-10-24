import { findMarketplaces, matchesTerm, pluginLinks } from "./marketplace.js";

const PAGE_SIZE = 20;
const byID = (id) => document.getElementById(id);
const form = byID("search-form");
const term = byID("search-term");
const button = byID("search-button");
const resultsSection = byID("results");
const status = byID("search-status");
const options = byID("result-options");
const more = byID("more-results");
const actions = byID("actions");
const marketplaceBrowser = byID("marketplace-browser");
const marketplaceFilter = byID("marketplace-filter");
const marketplacePlugins = byID("marketplace-plugins");
let results = [];
let activePlugin = null;
let shown = 0;
let controller = null;
let retryTimer = null;
let launched = null;
const launchButtons = ["marketplace-launch", "plugin-launch", "session-launch"].map(byID);

function clearDone() {
  launchButtons.forEach((link) => link.classList.remove("done"));
}

launchButtons.forEach((link) => link.addEventListener("click", (event) => {
  if (!link.href) return;
  const tab = window.open(link.href, "_blank");
  if (!tab) return;
  event.preventDefault();
  launched = { link, tab };
}));

function returned() {
  if (!launched || document.hidden || !document.hasFocus()) return;
  const { link, tab } = launched;
  launched = null;
  tab?.close();
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

function option(value, repository, title, stars, description) {
  const label = document.createElement("label");
  label.className = "option";
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "result";
  radio.value = value;
  const heading = document.createElement("span");
  heading.className = "option-heading";
  const name = document.createElement("strong");
  name.textContent = title;
  name.title = title;
  const source = document.createElement("small");
  source.className = "repository";
  source.textContent = `· ${repository}`;
  source.title = repository;
  heading.append(name, source);
  if (stars) {
    const reputation = document.createElement("small");
    reputation.className = "stars";
    reputation.textContent = stars;
    heading.append(reputation);
  }
  const body = document.createElement("span");
  body.className = "option-body";
  body.append(heading);
  if (description) {
    const text = document.createElement("span");
    text.textContent = description;
    body.append(text);
  }
  label.append(radio, body);
  const wrapper = document.createElement("div");
  wrapper.className = "result";
  wrapper.append(label);
  return wrapper;
}

const selected = () => results[Number(options.querySelector("input:checked")?.value)];

function updateLinks() {
  const result = selected();
  const plugin = activePlugin ?? result?.plugin;
  const links = result ? pluginLinks(result.marketplace.repository, result.marketplace.name, plugin.name) : null;
  setLink("marketplace-launch", links?.marketplace);
  setLink("plugin-launch", links?.plugin);
  setLink("session-launch", links?.session);
  if (result) byID("manifest-link").href = result.marketplace.manifestURL;
  byID("selected-plugin").textContent = result ? `Selected: ${plugin.name}@${result.marketplace.name}` : "";
}

function filterMarketplace() {
  const marketplace = selected()?.marketplace;
  if (!marketplace) return;
  const query = marketplaceFilter.value.trim().toLowerCase();
  let visible = 0;
  [...marketplacePlugins.children].forEach((button, index) => {
    const plugin = marketplace.plugins[index];
    button.hidden = !`${plugin.name} ${plugin.description}`.toLowerCase().includes(query);
    if (!button.hidden) visible++;
  });
  byID("marketplace-count").textContent = `${visible} of ${marketplace.plugins.length} plugins · ${marketplace.repository}`;
}

function renderMarketplace() {
  const result = selected();
  marketplaceFilter.value = "";
  marketplaceBrowser.open = false;
  marketplacePlugins.replaceChildren();
  if (!result) return;
  const { marketplace } = result;
  byID("marketplace-summary").textContent = `Browse marketplace · ${marketplace.plugins.length} ${marketplace.plugins.length === 1 ? "plugin" : "plugins"}`;
  for (const plugin of marketplace.plugins) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "marketplace-choice";
    choice.dataset.plugin = plugin.name;
    choice.title = plugin.description;
    const name = document.createElement("span");
    name.textContent = plugin.name;
    const marker = document.createElement("span");
    marker.className = "choice-marker";
    choice.append(name, marker);
    choice.addEventListener("click", () => {
      activePlugin = plugin;
      clearDone();
      updateLinks();
      updateMarketplaceSelection();
    });
    marketplacePlugins.append(choice);
  }
  updateMarketplaceSelection();
  filterMarketplace();
}

function updateMarketplaceSelection() {
  const plugin = activePlugin ?? selected()?.plugin;
  for (const choice of marketplacePlugins.children) {
    const checked = choice.dataset.plugin === plugin?.name;
    choice.setAttribute("aria-pressed", String(checked));
    choice.querySelector(".choice-marker").textContent = checked ? "Selected ✓" : "Select";
  }
}

function showMore() {
  results.slice(shown, shown + PAGE_SIZE).forEach(({ marketplace, plugin }, offset) => {
    const stars = marketplace.stars ? `★ ${marketplace.stars.toLocaleString()}` : "";
    options.append(option(String(shown + offset), marketplace.repository, plugin.name, stars, plugin.description || marketplace.description));
  });
  shown = Math.min(results.length, shown + PAGE_SIZE);
  more.hidden = shown >= results.length;
}

function render(marketplaces, searched) {
  const pairs = marketplaces.flatMap((marketplace) => marketplace.plugins.map((plugin) => ({ marketplace, plugin, match: matchesTerm(plugin, searched) })));
  results = [...pairs.filter((pair) => pair.match), ...pairs.filter((pair) => !pair.match)];
  shown = 0;
  activePlugin = null;
  actions.hidden = true;
  document.body.append(actions);
  options.replaceChildren();
  clearDone();
  renderMarketplace();
  showMore();
  updateLinks();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
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
  searchURL.searchParams.set("q", searched);
  window.history.replaceState(null, "", searchURL);
  document.body.classList.replace("home", "searched");
  resultsSection.hidden = false;
  render([], searched);
  button.disabled = true;
  form.setAttribute("aria-busy", "true");
  setStatus("Searching GitHub for plugin marketplaces…");
  try {
    const found = await findMarketplaces(searched, { signal: requestController.signal });
    if (controller !== requestController) return;
    render(found, searched);
    const count = results.length;
    const marketplaceCount = found.filter((marketplace) => marketplace.plugins.length > 0).length;
    setStatus(count
      ? `${count} ${count === 1 ? "plugin" : "plugins"} from ${marketplaceCount} ${marketplaceCount === 1 ? "marketplace" : "marketplaces"}. Select one to install it.`
      : `No plugins found for “${searched}”. Try another word or a GitHub owner name.`);
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

options.addEventListener("change", (event) => {
  if (event.target.name !== "result") return;
  activePlugin = null;
  clearDone();
  event.target.closest(".result").append(actions);
  actions.hidden = false;
  updateLinks();
  renderMarketplace();
});
more.addEventListener("click", showMore);
marketplaceFilter.addEventListener("input", filterMarketplace);

const initialSearch = new URLSearchParams(window.location.search).get("q")?.trim();
if (initialSearch) {
  term.value = initialSearch;
  form.requestSubmit();
}
