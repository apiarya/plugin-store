import { findMarketplaces, marketplaceMatchesTerm, matchesTerm, parseRepository, pluginLinks } from "./marketplace.js";

const byID = (id) => document.getElementById(id);
const form = byID("search-form");
const term = byID("search-term");
const button = byID("search-button");
const status = byID("search-status");
const marketplaceFields = byID("marketplace-fields");
const marketplaceOptions = byID("marketplace-options");
const pluginFields = byID("plugin-fields");
const pluginOptions = byID("plugin-options");
const target = byID("target-repo");
const targetError = byID("target-error");
let results = [];
let searchedTerm = "";
let controller = null;

const checked = (group) => group.querySelector("input:checked")?.value;

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

function setStep(id, enabled) {
  if (enabled) byID(id).removeAttribute("aria-disabled");
  else byID(id).setAttribute("aria-disabled", "true");
}

function setStatus(message, kind = "") {
  status.hidden = !message;
  status.className = `notice ${kind}`.trim();
  status.textContent = message;
}

function option(group, value, title, meta, description, isChecked) {
  const label = document.createElement("label");
  label.className = "option";
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = group;
  radio.value = value;
  radio.checked = isChecked;
  const heading = document.createElement("span");
  heading.className = "option-heading";
  const name = document.createElement("strong");
  name.textContent = title;
  heading.append(name);
  if (meta) {
    const extra = document.createElement("small");
    extra.textContent = meta;
    heading.append(extra);
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
  return label;
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

const selectedMarketplace = () => results.find((item) => item.repository === checked(marketplaceOptions));

function renderPlugins() {
  const marketplace = selectedMarketplace();
  pluginOptions.replaceChildren();
  pluginFields.hidden = !marketplace;
  if (!marketplace) return;
  byID("manifest-link").href = marketplace.manifestURL;
  const plugins = [...marketplace.plugins].sort((a, b) => matchesTerm(b, searchedTerm) - matchesTerm(a, searchedTerm));
  plugins.forEach((plugin, index) => {
    pluginOptions.append(option("plugin", plugin.name, plugin.name, matchesTerm(plugin, searchedTerm) ? "Matches your search" : "", plugin.description, index === 0));
  });
}

function updateLinks() {
  const marketplace = selectedMarketplace();
  const plugin = marketplace?.plugins.find((item) => item.name === checked(pluginOptions));
  const links = plugin ? pluginLinks(marketplace.repository, marketplace.name, plugin.name, targetRepository()) : null;
  setLink("marketplace-launch", links?.marketplace);
  setLink("plugin-launch", links?.plugin);
  setLink("session-launch", links?.session);
  setStep("step-plugin", Boolean(marketplace));
  setStep("step-session", Boolean(plugin));
  byID("prompt-details").hidden = !links;
  byID("prompt-preview").textContent = links?.prompt ?? "";
}

function renderMarketplaces() {
  marketplaceOptions.replaceChildren();
  marketplaceFields.hidden = results.length === 0;
  results.forEach((marketplace, index) => {
    const count = `${marketplace.plugins.length} ${marketplace.plugins.length === 1 ? "plugin" : "plugins"}`;
    const matched = marketplaceMatchesTerm(marketplace, searchedTerm) ? "Matches your search" : "";
    const meta = [marketplace.repository, marketplace.stars ? `★ ${marketplace.stars.toLocaleString()}` : "", count, matched].filter(Boolean).join(" · ");
    marketplaceOptions.append(option("marketplace", marketplace.repository, marketplace.name, meta, marketplace.description, index === 0));
  });
  renderPlugins();
  updateLinks();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  controller?.abort();
  const requestController = new AbortController();
  controller = requestController;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, 20000);
  results = [];
  searchedTerm = term.value.trim();
  renderMarketplaces();
  button.disabled = true;
  button.textContent = "Searching…";
  form.setAttribute("aria-busy", "true");
  setStatus("Searching GitHub and checking marketplace manifests…");
  try {
    const found = await findMarketplaces(searchedTerm, { signal: requestController.signal });
    if (controller !== requestController) return;
    results = found.filter((marketplace) => marketplace.plugins.length > 0);
    if (results.length === 0) {
      setStatus(found.length ? "That marketplace has no plugins listed in its manifest." : `No marketplaces found for “${searchedTerm}”. Try a broader word.`);
    } else {
      setStatus(`${results.length} ${results.length === 1 ? "marketplace" : "marketplaces"} found. Pick one, then add it to Copilot.`, "success");
    }
    renderMarketplaces();
  } catch (error) {
    if (controller !== requestController) return;
    if (timedOut) setStatus("GitHub took too long to respond. Check your connection and try again.", "error");
    else if (error instanceof TypeError) setStatus("Could not reach GitHub. Check your connection or browser network restrictions, then try again.", "error");
    else setStatus(error.message, "error");
  } finally {
    clearTimeout(timeout);
    if (controller === requestController) {
      controller = null;
      form.removeAttribute("aria-busy");
      button.disabled = false;
      button.textContent = "Search";
    }
  }
});

marketplaceOptions.addEventListener("change", () => {
  renderPlugins();
  updateLinks();
});
pluginOptions.addEventListener("change", updateLinks);
target.addEventListener("input", updateLinks);
