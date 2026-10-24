# Plugin Store

**Discover what your agent can do.**

A single-page, browser-only directory and launcher for public GitHub marketplace plugins in the GitHub Copilot desktop app.

**Site:** https://apiarya.github.io/plugin-store/

## Use it

Browse **Coding**, **Productivity**, **Data & AI**, **Security**, and **Research**, or use the full-width **Find your next plugin** search below the logo. A single caption under **Discover plugins** identifies the curated marketplaces and snapshot age. Category tiles show GitHub publisher avatars and open the same marketplace product view and Copilot actions as search-result cards, without navigating to another page. **Browse categories** or the Plugin Store logo returns to browsing and cancels any pending search.

On the homepage, **Try a search** examples run keyword (`database`), owner (`vercel`), and repository (`oracle/skills`) searches. **Jump to a plugin** links open Oracle DB, Next.js, and Diffusers with the exact plugin already selected. These shortcuts preserve the current site origin and deployment path and disappear in search results and marketplace views. Their marketplace manifests and plugin identifiers were verified on October 24, 2026.

Selecting a marketplace opens a product-style view at the same width as the storefront, with its publisher avatar, description, repository metadata, plugin chooser, and three Copilot actions. Global search, result counts, and sorting are hidden in this view; the plugin filter and visible **Choose a plugin** heading appear only when the marketplace has more than one plugin. Single-plugin marketplaces retain a screen-reader-only **Plugin** heading. Filtering down to one matching plugin does not hide the filter or heading. **Search results** returns to the previous search without fetching again, when entered from search. The Plugin Store logo returns to the store.

Browser **Back** and **Forward** navigate between browsing, searches, and marketplace views. Searches already loaded in the current page are restored without fetching again, including expanded result pages when returning from a marketplace. Plugin selection updates the current marketplace history entry, so Back returns to the search rather than stepping through every plugin selection.

Coding features seven well-known publishers in a hand-picked order (Next.js, Claude Code, Microsoft, Oracle, Stripe, Awesome Copilot, and Superpowers); Productivity likewise features seven (Work IQ, Knowledge Work, Notion, Planning with Files, Atlassian, Copilot Plugins, and Miro). Data & AI features thirteen, led by Diffusers, Azure Skills, Financial Services, Supabase, and LangChain. Research features twenty-five, led by AI Research Skills, Claude for Legal, Perplexity, and Hugging Face Skills. Security features twenty-two, led by Cloudflare, AWS, Claude Plugins, and HashiCorp. Within each row, picks after the hand-ordered leaders follow repository stars. All picks have verified manifests. Each category is a horizontally scrolling row that snaps card by card. Star and plugin counts are a snapshot from October 24, 2026, not live ratings or an exhaustive ranking. The snapshot age appears as relative time (for example, **today** or **5 days ago**), with the exact date available on hover. Selecting a marketplace fetches its current metadata and plugins. An avatar identifies its publisher, not a verification badge; plugin compatibility varies.

1. Search marketplaces by repository, owner, or keyword (for example `security`, `work-iq`, or an owner such as `forcedotcom`), or enter a repository as `owner/repository`. Results replace the category rows on the storefront, using the same marketplace cards in three columns on desktop, two on tablets, and one on phones. The page runs public GitHub repository searches for `<term>`, `<term> plugin`, and, when the term could be an owner name, `user:<term>`, and keeps only repositories that contain a marketplace manifest. Curated marketplaces whose name, repository, or description matches the term are also checked, so well-known marketplaces from large organizations (for example, `microsoft`) appear even when GitHub ranks other repositories first. Plugin names and descriptions are used to order results, not to discover repositories.
2. Each card is one marketplace, showing its repository, description, plugin count, stars, owner avatar, up to three topics, and relative last-push time (for example, **Last push 2 days ago**) when available. Hover over the time for the exact timestamp. The time refers to repository activity, not necessarily a plugin update; the avatar identifies the owner and is not a verification badge. Marketplaces containing a plugin that matches your search come first; the rest follow in GitHub's best-match order.
   Use **Sort by → Most stars** to order all discovered marketplaces by descending repository stars, or **Best match** to restore relevance ordering. Sorting does not make additional GitHub requests; it only reorders the marketplaces already found.
3. Select a marketplace to browse its plugins and show three buttons: **Add marketplace**, **Install plugin**, and **Ask “What can you do?”**. The first matching plugin (or the marketplace's first plugin) is selected initially. Each button opens a small tab (`launch.html`) that hands the link to the Copilot app and closes itself when you return to the browser; the step is then marked ✓ and the next button is focused. If the app doesn't open, the tab offers GitHub's hosted launcher instead. The chat button starts a session in the `apiarya/plugin-store` repository, which must be available in your Copilot app.
4. **Choose a plugin** is always expanded in the marketplace product view, with selectable cards showing each plugin's title and a two-line description. The selected card is highlighted and expands to show its full description inside the card. Up to five cards appear per page, with **Previous** and **Next** controls for larger marketplaces; the initial page includes the selected plugin. Filtering searches all plugins, not just the current page, and resets to the first matching page. A filtered count appears only while filtering, or **No matching plugins** when none match. Selecting a marketplace or plugin focuses **1 Add marketplace**. The action buttons follow the cards, without a repeated description. Choosing a plugin updates the highlighted selection and install and chat links without changing your search results. Selecting a different marketplace resets that choice.

The action buttons show the marketplace name for **Add marketplace** and the selected plugin name for **Install plugin** and **Ask “What can you do?”**. Selecting a marketplace or plugin highlights **1 Add marketplace** as the first step. The highlight follows whichever action you focus or click, so only one button is highlighted. Returning from a launch tab marks that step done and focuses and highlights the next action.

Plugin cards show a small version badge beside the name when the marketplace's plugin entry provides a version. Missing versions are left out; the marketplace's own version is never substituted, and no additional requests are made.

Marketplace and plugin identifiers come from manifest contents, not repository names. The site checks `.claude-plugin/marketplace.json`, then `.github/plugin/marketplace.json`, on each repository's default branch. Unauthenticated GitHub search allows about 10 API searches per minute, and each page search uses up to three (manifest checks don't count toward it). If the limit is reached, the page counts down and retries automatically. Loading, loading, empty manifests, and errors are shown on the page.

The page cannot detect installation success or force plugin activation. The documented session endpoint requires a repository and has no plugin-binding parameter, so sessions always open in `apiarya/plugin-store` and the opening prompt requests the plugin by its `plugin@marketplace` identifier.

## Share a search

Add a URL-encoded search term as the `q` query parameter to open and run a search automatically:

- https://apiarya.github.io/plugin-store/?q=work-iq
- https://apiarya.github.io/plugin-store/?q=clinical-trial
- https://apiarya.github.io/plugin-store/?q=anthropics%2Flife-sciences

Searching also updates the address bar, so you can copy its URL to share the current query. The same links work locally with `http://localhost:8000/` as the base URL. Empty or whitespace-only `q` values leave the home page open without searching. Sharing a query does not change search coverage or guarantee that a plugin will be found.

Category selections also set `select=owner%2Frepository` alongside the matching `q` repository query. These URLs select the marketplace through the normal search-result flow and focus **1 Add marketplace**. Other searches retain their normal result-selection behavior.

To link to a specific plugin, add its exact manifest name as `plugin`:

- https://apiarya.github.io/plugin-store/?q=wshobson%2Fagents&select=wshobson%2Fagents&plugin=operating-kit

Use **Share** (the outlined share icon) beside the marketplace title to copy a link to the whole marketplace without a specific plugin selection. Use **Share** inside the selected plugin card to copy that plugin's link. Each button has a context-specific accessible label and tooltip. The plugin share control appears only on the selected card; if filtering or pagination hides that card, it reappears when the card is visible again. Both buttons briefly show **✓ Link copied** on success; if clipboard access is unavailable or denied, the page displays the exact link for manual copying. Selecting a plugin also updates the address bar, so copying the URL preserves the selection. Opening a plugin link shows the selected plugin's page, updates all three Copilot actions, and focuses **1 Add marketplace**. Plugin names are case-sensitive. If the linked plugin is no longer present, the page shows an explicit notice and lets you choose an available plugin. Returning to the store or search clears the plugin parameter.

## Local development

No dependencies or build step are required. With Node.js 22+ and Python 3:

```sh
npm test
npm run serve
```

Open http://localhost:8000. Serve over HTTP rather than opening `index.html` directly, so browser modules load correctly.

## Deployment

In repository **Settings → Pages**, select **GitHub Actions** as the source. Push to `main` to run `.github/workflows/pages.yml`, which runs the tests and deploys only the static site assets, including `launch.html` and `launch.js` for the Copilot handoff. The workflow can also be started manually. No tokens, secrets, package installation, or backend are required.

## Privacy and trust

Repository and manifest requests go directly from your browser to `api.github.com` and `raw.githubusercontent.com`; owner avatars load from `avatars.githubusercontent.com` without sending a referrer. There is no analytics or local storage. Manifest text is rendered as text, never HTML, and no marketplace code is executed by this site. Review marketplaces and plugins before installing them. Repository access remains governed by Copilot and GitHub when opening a session.

App links follow the [official Copilot deep-link documentation](https://docs.github.com/en/copilot/how-tos/github-copilot-app/open-with-deep-links): query values are encoded first, then the entire `ghapp://` link is encoded inside `https://github.com/copilot/app/launch?open=…`.

This is an independent project, not affiliated with GitHub.

## Analytics

The published site (`apiarya.github.io`) uses Google Analytics 4 (`G-B8TTJGCDXK`) to count page views, searches (`search` with the search term and result count), and launch clicks (`add_marketplace`, `install_plugin`, `ask_plugin` with the marketplace repository and plugin name). `analytics.js` loads the Google tag only on that host, so local previews are not tracked. The Content-Security-Policy allows scripts from `www.googletagmanager.com` and connections to Google Analytics; inline scripts remain blocked.
