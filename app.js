import { discoverMarketplace, parseRepository, pluginLinks } from "./marketplace.js";

const byID = (id) => document.getElementById(id);
const form = byID("marketplace-form");
const preset = byID("marketplace-preset");
const source = byID("marketplace-source");
const button = byID("discover-button");
const status = byID("discovery-status");
const fields = byID("plugin-fields");
const select = byID("plugin-select");
const target = byID("target-repo");
const targetError = byID("target-error");
let marketplace = null;
let controller = null;

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

function updateLinks() {
  let targetRepository = "";
  targetError.textContent = "";
  target.removeAttribute("aria-invalid");
  if (target.value.trim()) {
    try {
      targetRepository = parseRepository(target.value);
    } catch (error) {
      targetError.textContent = error.message;
      target.setAttribute("aria-invalid", "true");
    }
  }
  const plugin = marketplace?.plugins.find((item) => item.name === select.value);
  const links = plugin ? pluginLinks(marketplace.repository, marketplace.name, plugin.name, targetRepository) : null;
  setLink("marketplace-launch", links?.marketplace);
  setLink("plugin-launch", links?.plugin);
  setLink("session-launch", links?.session);
  byID("prompt-details").hidden = !links;
  byID("prompt-preview").textContent = links?.prompt ?? "";
  if (plugin) {
    byID("plugin-name").textContent = plugin.name;
    byID("plugin-description").textContent = plugin.description;
    byID("plugin-id").textContent = `${plugin.name}@${marketplace.name}`;
  }
}

function resetDiscovery() {
  controller?.abort();
  controller = null;
  marketplace = null;
  fields.hidden = true;
  select.replaceChildren();
  form.removeAttribute("aria-busy");
  button.disabled = false;
  button.textContent = "Find plugins →";
  status.className = "notice";
  status.textContent = "Choose a marketplace, then select Find plugins.";
  updateLinks();
}

preset.addEventListener("change", () => {
  source.value = preset.value;
  resetDiscovery();
  if (!preset.value) source.focus();
});

source.addEventListener("input", () => {
  preset.value = [...preset.options].some((option) => option.value === source.value.trim()) ? source.value.trim() : "";
  source.removeAttribute("aria-invalid");
  resetDiscovery();
});

select.addEventListener("change", updateLinks);
target.addEventListener("input", updateLinks);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetDiscovery();
  const requestController = new AbortController();
  controller = requestController;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, 20000);
  button.disabled = true;
  button.textContent = "Finding plugins…";
  form.setAttribute("aria-busy", "true");
  status.textContent = "Reading the marketplace manifest from GitHub…";
  try {
    parseRepository(source.value);
    source.removeAttribute("aria-invalid");
    const result = await discoverMarketplace(source.value, { signal: requestController.signal });
    if (controller !== requestController) return;
    marketplace = result;
    byID("manifest-link").href = result.manifestURL;
    for (const plugin of result.plugins) {
      const option = document.createElement("option");
      option.value = plugin.name;
      option.textContent = plugin.name;
      select.append(option);
    }
    if (result.plugins.length === 0) {
      status.textContent = `The "${result.name}" marketplace has no plugins listed in its manifest. Try another marketplace.`;
    } else {
      status.className = "notice success";
      status.textContent = `${result.plugins.length} ${result.plugins.length === 1 ? "plugin" : "plugins"} found in ${result.name}. Pick one below to get started.`;
      fields.hidden = false;
    }
    updateLinks();
  } catch (error) {
    if (controller !== requestController) return;
    status.className = "notice error";
    if (timedOut) {
      status.textContent = "GitHub took too long to respond. Check your connection and try again.";
    } else if (error instanceof TypeError) {
      status.textContent = "Could not reach GitHub. Check your connection or browser network restrictions, then try again.";
    } else {
      status.textContent = error.message;
    }
    try {
      parseRepository(source.value);
    } catch {
      source.setAttribute("aria-invalid", "true");
    }
  } finally {
    clearTimeout(timeout);
    if (controller === requestController) {
      controller = null;
      form.removeAttribute("aria-busy");
      button.disabled = false;
      button.textContent = "Find plugins →";
    }
  }
});
