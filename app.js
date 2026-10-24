import { discoverMarketplace, launchLink, parseRepository, pluginLinks } from "./marketplace.js";

const byID = (id) => document.getElementById(id);
const form = byID("marketplace-form");
const source = byID("marketplace-source");
const sourceError = byID("source-error");
const status = byID("discovery-status");
const fields = byID("plugin-fields");
const select = byID("plugin-select");
const target = byID("target-repo");
const targetError = byID("target-error");
let marketplace = null;
let controller = null;
let debounce = null;

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

function validRepository(input, error) {
  error.textContent = "";
  input.removeAttribute("aria-invalid");
  if (!input.value.trim()) return "";
  try {
    return parseRepository(input.value);
  } catch (err) {
    error.textContent = err.message;
    input.setAttribute("aria-invalid", "true");
    return "";
  }
}

function updateLinks() {
  const repository = validRepository(source, sourceError);
  setLink("marketplace-launch", repository ? launchLink("plugins/marketplace/add", { source: repository }) : null);
  const targetRepository = validRepository(target, targetError);
  const plugin = marketplace?.plugins.find((item) => item.name === select.value);
  const links = plugin ? pluginLinks(marketplace.repository, marketplace.name, plugin.name, targetRepository) : null;
  setLink("plugin-launch", links?.plugin);
  setLink("session-launch", links?.session);
  setStep("step-plugin", Boolean(marketplace));
  setStep("step-session", Boolean(plugin));
  byID("prompt-details").hidden = !links;
  byID("prompt-preview").textContent = links?.prompt ?? "";
  if (plugin) {
    byID("plugin-name").textContent = plugin.name;
    byID("plugin-description").textContent = plugin.description;
    byID("plugin-id").textContent = `${plugin.name}@${marketplace.name}`;
  }
}

function resetDiscovery(message = "Choose a marketplace to see its plugins.") {
  clearTimeout(debounce);
  controller?.abort();
  controller = null;
  marketplace = null;
  fields.hidden = true;
  select.replaceChildren();
  form.removeAttribute("aria-busy");
  status.className = "notice";
  status.textContent = message;
  updateLinks();
}

async function discover() {
  resetDiscovery();
  let repository;
  try {
    repository = parseRepository(source.value);
  } catch {
    return;
  }
  const requestController = new AbortController();
  controller = requestController;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, 20000);
  form.setAttribute("aria-busy", "true");
  status.textContent = "Reading the marketplace manifest from GitHub…";
  try {
    const result = await discoverMarketplace(repository, { signal: requestController.signal });
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
      status.textContent = `${result.plugins.length} ${result.plugins.length === 1 ? "plugin" : "plugins"} found in ${result.name}.`;
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
  } finally {
    clearTimeout(timeout);
    if (controller === requestController) {
      controller = null;
      form.removeAttribute("aria-busy");
    }
  }
}

source.addEventListener("input", () => {
  resetDiscovery();
  debounce = setTimeout(discover, 600);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  discover();
});

select.addEventListener("change", updateLinks);
target.addEventListener("input", updateLinks);

discover();
