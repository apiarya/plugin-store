import { parseRepository } from "./marketplace.js";

export const snapshotDate = "2026-10-24";

export const categories = [
  { id: "coding", label: "Coding", curatedOrder: true },
  { id: "productivity", label: "Productivity", curatedOrder: true },
  { id: "data-ai", label: "Data & AI", curatedOrder: true },
  { id: "security", label: "Security" },
  { id: "research", label: "Research" },
];

export const marketplaces = [
  {
    category: "coding", name: "Next.js", repository: "vercel/next.js",
    avatarURL: "https://avatars.githubusercontent.com/u/14985020?v=4&s=96",
    description: "Official Next.js skills for Cache Components, prefetching, and runtime verification.",
    stars: 143216, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/vercel/next.js/canary/.claude-plugin/marketplace.json",
  },
  {
    category: "coding", name: "Claude Code", repository: "anthropics/claude-code",
    avatarURL: "https://avatars.githubusercontent.com/u/76263028?v=4&s=96",
    description: "Feature development, code review, frontend design, and Git workflow plugins.",
    stars: 153276, pluginCount: 13,
    manifestURL: "https://raw.githubusercontent.com/anthropics/claude-code/main/.claude-plugin/marketplace.json",
  },
  {
    category: "coding", name: "Microsoft Skills", repository: "microsoft/skills",
    avatarURL: "https://avatars.githubusercontent.com/u/6154722?v=4&s=96",
    description: "Azure SDK guidance across languages, cloud development, and code documentation.",
    stars: 3145, pluginCount: 13,
    manifestURL: "https://raw.githubusercontent.com/microsoft/skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "coding", name: "Oracle Skills", repository: "oracle/skills",
    avatarURL: "https://avatars.githubusercontent.com/u/4430336?v=4&s=96",
    description: "SQL, PL/SQL, APEX, GraalVM, and Oracle Cloud development guidance.",
    stars: 900, pluginCount: 5,
    manifestURL: "https://raw.githubusercontent.com/oracle/skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "coding", name: "Stripe", repository: "stripe/ai",
    avatarURL: "https://avatars.githubusercontent.com/u/856813?v=4&s=96",
    description: "Build Stripe integrations and AI-powered commerce products.",
    stars: 1965, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/stripe/ai/main/.claude-plugin/marketplace.json",
  },
  {
    category: "coding", name: "Awesome Copilot", repository: "github/awesome-copilot",
    avatarURL: "https://avatars.githubusercontent.com/u/9919?v=4&s=96",
    description: "Community-contributed skills, agents, instructions, and plugins for GitHub Copilot.",
    stars: 40373, pluginCount: 184,
    manifestURL: "https://raw.githubusercontent.com/github/awesome-copilot/main/.github/plugin/marketplace.json",
  },
  {
    category: "coding", name: "Superpowers", repository: "obra/superpowers",
    avatarURL: "https://avatars.githubusercontent.com/u/45416?v=4&s=96",
    description: "Core skills for TDD, debugging, collaboration patterns, and proven techniques.",
    stars: 304597, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/obra/superpowers/main/.claude-plugin/marketplace.json",
  },
  {
    category: "productivity", name: "Work IQ", repository: "microsoft/work-iq",
    avatarURL: "https://avatars.githubusercontent.com/u/6154722?v=4&s=96",
    description: "Connect your agent to Microsoft 365 email, meetings, documents, and more.",
    stars: 1041, pluginCount: 4,
    manifestURL: "https://raw.githubusercontent.com/microsoft/work-iq/main/.claude-plugin/marketplace.json",
  },
  {
    category: "productivity", name: "Knowledge Work", repository: "anthropics/knowledge-work-plugins",
    avatarURL: "https://avatars.githubusercontent.com/u/76263028?v=4&s=96",
    description: "Plugins for everyday knowledge work, originally built for Claude Cowork.",
    stars: 32583, pluginCount: 123,
    manifestURL: "https://raw.githubusercontent.com/anthropics/knowledge-work-plugins/main/.claude-plugin/marketplace.json",
  },
  {
    category: "productivity", name: "Notion", repository: "makenotion/claude-code-notion-plugin",
    avatarURL: "https://avatars.githubusercontent.com/u/4792552?v=4&s=96",
    description: "Notion skills and MCP server to search, create, and update your workspace.",
    stars: 499, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/makenotion/claude-code-notion-plugin/main/.claude-plugin/marketplace.json",
  },
  {
    category: "productivity", name: "Planning with Files", repository: "OthmanAdi/planning-with-files",
    avatarURL: "https://avatars.githubusercontent.com/u/78882424?v=4&s=96",
    description: "Persistent file-based plans and session recovery for long-running agent tasks.",
    stars: 27627, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/OthmanAdi/planning-with-files/master/.claude-plugin/marketplace.json",
  },
  {
    category: "productivity", name: "Atlassian", repository: "atlassian/atlassian-mcp-server",
    avatarURL: "https://avatars.githubusercontent.com/u/168166?v=4&s=96",
    description: "Search and manage Jira issues and Confluence pages from your agent.",
    stars: 1121, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/atlassian/atlassian-mcp-server/main/.claude-plugin/marketplace.json",
  },
  {
    category: "productivity", name: "Copilot Plugins", repository: "github/copilot-plugins",
    avatarURL: "https://avatars.githubusercontent.com/u/9919?v=4&s=96",
    description: "Official GitHub Copilot plugins, including Work IQ, Microsoft 365 agents, and Spark.",
    stars: 376, pluginCount: 18,
    manifestURL: "https://raw.githubusercontent.com/github/copilot-plugins/main/.github/plugin/marketplace.json",
  },
  {
    category: "productivity", name: "Miro", repository: "miroapp/miro-ai",
    avatarURL: "https://avatars.githubusercontent.com/u/48276018?v=4&s=96",
    description: "Read Miro board context and generate diagrams on your boards.",
    stars: 163, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/miroapp/miro-ai/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Diffusers", repository: "huggingface/diffusers",
    avatarURL: "https://avatars.githubusercontent.com/u/25720743?v=4&s=96",
    description: "Conventions and task skills for working with Hugging Face diffusion models.",
    stars: 34793, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/huggingface/diffusers/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Azure Skills", repository: "microsoft/azure-skills",
    avatarURL: "https://avatars.githubusercontent.com/u/6154722?v=4&s=96",
    description: "Official Azure skills and MCP configurations for cloud and AI workflows.",
    stars: 1590, pluginCount: 7,
    manifestURL: "https://raw.githubusercontent.com/microsoft/azure-skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Financial Services", repository: "anthropics/financial-services-plugins",
    avatarURL: "https://avatars.githubusercontent.com/u/76263028?v=4&s=96",
    description: "Financial analysis, equity research, and investment workflows.",
    stars: 40739, pluginCount: 19,
    manifestURL: "https://raw.githubusercontent.com/anthropics/financial-services-plugins/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Supabase", repository: "supabase/agent-skills",
    avatarURL: "https://avatars.githubusercontent.com/u/54469796?v=4&s=96",
    description: "Supabase and Postgres best practices for databases, auth, and storage.",
    stars: 2922, pluginCount: 2,
    manifestURL: "https://raw.githubusercontent.com/supabase/agent-skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "LangChain", repository: "langchain-ai/langchain-skills",
    avatarURL: "https://avatars.githubusercontent.com/u/126733545?v=4&s=96",
    description: "Build agents with LangChain, LangGraph, and Deep Agents.",
    stars: 1313, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/langchain-ai/langchain-skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Anthropic Skills", repository: "anthropics/skills",
    avatarURL: "https://avatars.githubusercontent.com/u/76263028?v=4&s=96",
    description: "Reusable skills for spreadsheets, documents, and Claude API workflows.",
    stars: 183363, pluginCount: 5,
    manifestURL: "https://raw.githubusercontent.com/anthropics/skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Hugging Face Skills", repository: "huggingface/skills",
    avatarURL: "https://avatars.githubusercontent.com/u/25720743?v=4&s=96",
    description: "Run Hugging Face Hub operations for models, datasets, and Spaces.",
    stars: 11208, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/huggingface/skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Firebase", repository: "firebase/firebase-tools",
    avatarURL: "https://avatars.githubusercontent.com/u/1335026?v=4&s=96",
    description: "Firebase MCP server and skills for building and deploying apps.",
    stars: 4481, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/firebase/firebase-tools/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "dbt Labs", repository: "dbt-labs/dbt-agent-skills",
    avatarURL: "https://avatars.githubusercontent.com/u/18339788?v=4&s=96",
    description: "Analytics engineering with dbt: models, tests, and migrations to Fusion.",
    stars: 746, pluginCount: 3,
    manifestURL: "https://raw.githubusercontent.com/dbt-labs/dbt-agent-skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "DuckDB", repository: "duckdb/duckdb-skills",
    avatarURL: "https://avatars.githubusercontent.com/u/82039556?v=4&s=96",
    description: "Query any data file and attach databases with DuckDB.",
    stars: 610, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/duckdb/duckdb-skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Elastic", repository: "elastic/agent-skills",
    avatarURL: "https://avatars.githubusercontent.com/u/6764390?v=4&s=96",
    description: "Elasticsearch, Kibana, and Observability skills including ES|QL.",
    stars: 600, pluginCount: 5,
    manifestURL: "https://raw.githubusercontent.com/elastic/agent-skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "ClickHouse", repository: "ClickHouse/agent-skills",
    avatarURL: "https://avatars.githubusercontent.com/u/54801242?v=4&s=96",
    description: "ClickHouse schema design, query optimization, and architecture guidance.",
    stars: 560, pluginCount: 8,
    manifestURL: "https://raw.githubusercontent.com/ClickHouse/agent-skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "Databricks", repository: "databricks/databricks-agent-skills",
    avatarURL: "https://avatars.githubusercontent.com/u/4998052?v=4&s=96",
    description: "Databricks CLI, Apps, Lakebase, Model Serving, and Lakeflow skills.",
    stars: 369, pluginCount: 1,
    manifestURL: "https://raw.githubusercontent.com/databricks/databricks-agent-skills/main/.claude-plugin/marketplace.json",
  },
  {
    category: "data-ai", name: "MongoDB", repository: "mongodb/agent-skills",
    avatarURL: "https://avatars.githubusercontent.com/u/45120?v=4&s=96",
    description: "Work with MongoDB databases and Atlas from your agent.",
    stars: 190, pluginCount: 2,
    manifestURL: "https://raw.githubusercontent.com/mongodb/agent-skills/main/.claude-plugin/marketplace.json",
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
  const curated = categories.some(({ id, curatedOrder }) => id === category && curatedOrder);
  return marketplaces.filter((marketplace) => marketplace.category === category)
    .sort((a, b) => curated ? 0 : b.stars - a.stars || a.name.localeCompare(b.name));
}

export function marketplaceURL(repository) {
  const source = parseRepository(repository);
  return `./?${new URLSearchParams({ q: source, select: source })}`;
}
