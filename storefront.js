import { categories, marketplaceURL, rankedMarketplaces, snapshotDate } from "./catalog.js";
import { formatRelativeTime } from "./marketplace.js";

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

export function topicTags(topics) {
  return topics.map((topic) => element("span", "topic-tag", topic));
}

export function createMarketplaceCard(pick, onSelect) {
  const card = element("a", "marketplace-card", "");
  card.href = marketplaceURL(pick.repository);
  card.dataset.repository = pick.repository;
  card.dataset.stars = String(pick.stars);
  card.setAttribute("aria-label", `Browse ${pick.name} plugins`);
  card.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(pick.repository);
  });
  const top = element("div", "card-top", "");
  if (pick.avatarURL) {
    const avatar = document.createElement("img");
    avatar.className = "marketplace-avatar";
    avatar.src = pick.avatarURL;
    avatar.alt = "";
    avatar.width = 48;
    avatar.height = 48;
    avatar.loading = "lazy";
    avatar.decoding = "async";
    avatar.referrerPolicy = "no-referrer";
    top.append(avatar);
  }
  const identity = element("div", "card-identity", "");
  const count = pick.plugins?.length ?? pick.pluginCount;
  identity.append(
    element("h3", "card-name", pick.name),
    element("span", "card-publisher", pick.repository),
    element("span", "card-count", `${count} ${count === 1 ? "plugin" : "plugins"}`),
  );
  top.append(identity);
  card.append(top, element("p", "card-description", pick.description));
  if (pick.topics?.length) {
    const tags = element("div", "result-topics", "");
    tags.append(...topicTags(pick.topics));
    card.append(tags);
  }
  if (pick.pushedAt) {
    const updated = element("time", "last-push", `Last push ${formatRelativeTime(pick.pushedAt)}`);
    updated.dateTime = pick.pushedAt;
    updated.title = new Date(pick.pushedAt).toLocaleString();
    card.append(updated);
  }
  const bottom = element("div", "card-bottom", "");
  const stars = element("span", "card-stars", `★ ${pick.stars.toLocaleString("en-US")}`);
  stars.setAttribute("aria-label", `${pick.stars.toLocaleString("en-US")} GitHub repository stars`);
  bottom.append(stars, element("span", "view-button", "Browse plugins"));
  card.append(bottom);
  return card;
}

export function initializeStorefront(onSelect) {
  const sections = document.getElementById("marketplace-sections");
  const date = document.getElementById("catalog-date");
  date.dateTime = snapshotDate;
  const today = new Date(Date.now()).toISOString().slice(0, 10);
  date.textContent = snapshotDate === today ? "today" : formatRelativeTime(snapshotDate, Date.parse(today));
  date.title = new Date(`${snapshotDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });

  function render(category) {
    sections.replaceChildren();
    let count = 0;
    for (const group of categories.filter((group) => category === "all" || group.id === category)) {
      const section = element("section", "marketplace-category", "");
      section.dataset.category = group.id;
      section.setAttribute("aria-labelledby", `category-${group.id}`);
      const heading = element("h2", "category-title", group.label);
      heading.id = `category-${group.id}`;
      const grid = element("div", "marketplace-grid category-row", "");
      const picks = rankedMarketplaces(group.id);
      count += picks.length;
      for (const pick of picks) {
        grid.append(createMarketplaceCard(pick, onSelect));
      }
      section.append(heading, grid);
      sections.append(section);
    }
    document.getElementById("pick-count").textContent = `${count} marketplaces`;
  }

  document.querySelectorAll(".categories [data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".categories [data-category]").forEach((option) => {
        option.setAttribute("aria-pressed", String(option === button));
      });
      render(button.dataset.category);
    });
  });
  render("all");
}
