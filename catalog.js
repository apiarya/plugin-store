import { parseRepository } from "./marketplace.js";

export const snapshotDate = "2026-10-24";

export const categories = [
  { id: "coding", label: "Coding" },
  { id: "productivity", label: "Productivity" },
  { id: "data-ai", label: "Data & AI" },
  { id: "security", label: "Security" },
  { id: "research", label: "Research" },
];

export const marketplaces = [
  {
    category: "coding", name: "Superpowers", repository: "obra/superpowers",
    avatarURL: "https://avatars.githubusercontent.com/u/45416?v=4&s=96",
    description: "An agentic skills framework and methodology for software development.",
    stars: 304354, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/obra/superpowers/main/.claude-plugin/marketplace.json",
  },
  {
    category: "coding", name: "Agent Workflows", repository: "wshobson/agents",
    avatarURL: "https://avatars.githubusercontent.com/u/553618?v=4&s=96",
    description: "Software engineering workflows for agents across coding harnesses.",
    stars: 41618, pluginCount: 94,
    manifestURL: "https://raw.githubusercontent.com/wshobson/agents/main/.claude-plugin/marketplace.json",
  },
  {
    category: "coding", name: "Awesome Copilot", repository: "github/awesome-copilot",
    avatarURL: "https://avatars.githubusercontent.com/u/9919?v=4&s=96",
    description: "Community-contributed skills, agents, instructions, and plugins for GitHub Copilot.",
    stars: 40364, pluginCount: 184,
    manifestURL: "https://raw.githubusercontent.com/github/awesome-copilot/main/.github/plugin/marketplace.json",
  },
  {
    category: "productivity", name: "Knowledge Work", repository: "anthropics/knowledge-work-plugins",
    avatarURL: "https://avatars.githubusercontent.com/u/76263028?v=4&s=96",
    description: "Plugins for everyday knowledge work, originally built for Claude Cowork.",
    stars: 32398, pluginCount: 123,
    manifestURL: "https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/.claude-plugin/marketplace.json",
  },
  {
    category: "productivity", name: "Planning with Files", repository: "OthmanAdi/planning-with-files",
    avatarURL: "https://avatars.githubusercontent.com/u/78882424?v=4&s=96",
    description: "Persistent file-based plans and session recovery for long-running agent tasks.",
    stars: 27613, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/OthmanAdi/planning-with-files/master/.claude-plugin/marketplace.json",
  },
  {
    category: "productivity", name: "Work IQ", repository: "microsoft/work-iq",
    avatarURL: "https://avatars.githubusercontent.com/u/6154722?v=4&s=96",
    description: "Connect your agent to Microsoft 365 email, meetings, documents, and more.",
    stars: 1041, pluginCount: 4,
    manifestURL: "https://raw.githubusercontent.com/microsoft/work-iq/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Anthropic Skills", repository: "anthropics/skills",
    avatarURL: "https://avatars.githubusercontent.com/u/76263028?v=4&s=96",
    description: "Reusable skills for spreadsheets, documents, and Claude API workflows.",
    stars: 183363, pluginCount: 5,
    manifestURL: "https://raw.githubusercontent.com/anthropics/skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Financial Services", repository: "anthropics/financial-services-plugins",
    avatarURL: "https://avatars.githubusercontent.com/u/76263028?v=4&s=96",
    description: "Financial analysis, equity research, and investment workflows.",
    stars: 40739, pluginCount: 19,
    manifestURL: "https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Azure Skills", repository: "microsoft/azure-skills",
    avatarURL: "https://avatars.githubusercontent.com/u/6154722?v=4&s=96",
    description: "Official Azure skills and MCP configurations for cloud and AI workflows.",
    stars: 1590, pluginCount: 7,
    manifestURL: "https://raw.githubusercontent.com/microsoft/azure-skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "security", name: "Claude Plugins", repository: "anthropics/claude-plugins-official",
    avatarURL: "https://avatars.githubusercontent.com/u/76263028?v=4&s=96",
    description: "Anthropic's official directory, including API security and code-scanning plugins.",
    stars: 44195, pluginCount: 315,
    manifestURL: "https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json",
  },
  {
    category: "security", name: "Trail of Bits", repository: "trailofbits/skills",
    avatarURL: "https://avatars.githubusercontent.com/u/2314423?v=4&s=96",
    description: "Skills for security research, vulnerability detection, and audit workflows.",
    stars: 7764, pluginCount: 46,
    manifestURL: "https://raw.githubusercontent.com/trailofbits/skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "security", name: "Sentry Skills", repository: "getsentry/skills",
    avatarURL: "https://avatars.githubusercontent.com/u/1396951?v=4&s=96",
    description: "Sentry's development skills, including security and code review.",
    stars: 1083, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/getsentry/skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "research", name: "Claude for Legal", repository: "anthropics/claude-for-legal",
    avatarURL: "https://avatars.githubusercontent.com/u/76263028?v=4&s=96",
    description: "Legal research, case analysis, and regulatory review workflows.",
    stars: 9788, pluginCount: 13,
    manifestURL: "https://raw.githubusercontent.com/anthropics/claude-for-legal/main/.claude-plugin/marketplace.json",
  },
  {
    category: "research", name: "Scientific Writer", repository: "K-Dense-AI/claude-scientific-writer",
    avatarURL: "https://avatars.githubusercontent.com/u/238572432?v=4&s=96",
    description: "Scientific writing workflows for your coding agent.",
    stars: 2517, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/K-Dense-AI/claude-scientific-writer/main/.claude-plugin/marketplace.json",
  },
  {
    category: "research", name: "Life Sciences", repository: "anthropics/life-sciences",
    avatarURL: "https://avatars.githubusercontent.com/u/76263028?v=4&s=96",
    description: "Skills for clinical trial protocols and scientific problem selection.",
    stars: 625, pluginCount: 2,
    manifestURL: "https://raw.githubusercontent.com/anthropics/life-sciences/main/.claude-plugin/marketplace.json",
  },
];

export function rankedMarketplaces(category) {
  return marketplaces.filter((marketplace) => marketplace.category === category)
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
}

export function marketplaceURL(repository) {
  const source = parseRepository(repository);
  return `./?${new URLSearchParams({ q: source, select: source })}`;
}
