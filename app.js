import { findMarketplaces, matchesTerm, parseRepository, pluginLinks } from "./marketplace.js";

const PAGE_SIZE = 20;
const TARGET_KEY = "run-in-copilot:target-repo";
const byID = (id) => document.getElementById(id);
const form = byID("search-form");
const term = byID("search-term");
const button = byID("search-button");
const resultsSection = byID("results");
const status = byID("search-status");
const options = byID("result-options");
const more = byID("more-results");
const actions = byID("actions");
const target = byID("target-repo");
const targetError = byID("target-error");
let results = [];
let shown = 0;
let controller = null;
let retryTimer = null;

try {
  target.value = localStorage.getItem(TARGET_KEY) ?? "";
} catch {
  // Storage can be unavailable in private browsing; the field still works.
}

function setLink(id, href) {
  const link = byID(id);
  if (href) {
    link.href = href;
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
  const source = document.createElement("small");
  source.textContent = `${repository} /`;
  heading.append(source, name);
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

function targetRepository() {
  targetError.textContent = "";
  target.removeAttribute("aria-invalid");
  if (!target.value.trim()) return "";
  try {
    return parseRepository(target.value);
  } catch (error) {
    targetError.textContent = error.message;
    target.setAttribute("aria-invalid", "true");
    return "";
  }
}

const selected = () => results[Number(options.querySelector("input:checked")?.value)];

function updateLinks() {
  const result = selected();
  const links = result ? pluginLinks(result.marketplace.repository, result.marketplace.name, result.plugin.name, targetRepository()) : null;
  setLink("marketplace-launch", links?.marketplace);
  setLink("plugin-launch", links?.plugin);
  setLink("session-launch", links?.session);
  if (result) byID("manifest-link").href = result.marketplace.manifestURL;
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
  actions.hidden = true;
  document.body.append(actions);
  options.replaceChildren();
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
  event.target.closest(".result").append(actions);
  actions.hidden = false;
  updateLinks();
});
more.addEventListener("click", showMore);
target.addEventListener("input", () => {
  try {
    localStorage.setItem(TARGET_KEY, target.value.trim());
  } catch {
    // Ignore storage failures.
  }
  updateLinks();
});
