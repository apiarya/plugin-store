# Run in Copilot

A single-page, browser-only launcher for public GitHub marketplace plugins in the GitHub Copilot desktop app.

**Site:** https://apiarya.github.io/run-in-copilot/

## Use it

1. Search marketplaces by repository, owner, or keyword (for example `security`, `work-iq`, or an owner such as `forcedotcom`), or enter a repository as `owner/repository`. The page runs public GitHub repository searches for `<term>`, `<term> plugin`, and, when the term could be an owner name, `user:<term>`, and keeps only repositories that contain a marketplace manifest. Plugin names and descriptions are used to order results, not to discover repositories.
2. Each result is one marketplace, showing its repository, description, plugin count, stars, owner avatar, up to three topics, and relative last-push time (for example, **Last push 2 days ago**) when available. Hover over the time for the exact timestamp. The time refers to repository activity, not necessarily a plugin update; the avatar identifies the owner and is not a verification badge. Marketplaces containing a plugin that matches your search come first; the rest follow in GitHub's best-match order.
   Use **Sort by → Most stars** to order all discovered marketplaces by descending repository stars, or **Best match** to restore relevance ordering. Sorting preserves the selected plugin and does not make additional GitHub requests; it only reorders the marketplaces already found.
3. Select a marketplace to browse its plugins and show three buttons: **Add marketplace**, **Install plugin**, and **Ask “What can you do?”**. The first matching plugin (or the marketplace's first plugin) is selected initially. Each button opens a small tab (`launch.html`) that hands the link to the Copilot app and closes itself when you return to the browser; the step is then marked ✓ and the next button is focused. If the app doesn't open, the tab offers GitHub's hosted launcher instead. The chat button starts a session in the `apiarya/run-in-copilot` repository, which must be available in your Copilot app.
4. **Choose a plugin** is always expanded in a selected result, with selectable cards showing each plugin's title and a two-line description. The selected card is highlighted and expands to show its full description inside the card. Up to six cards appear per page, with **Previous** and **Next** controls for larger marketplaces; the initial page includes the selected plugin. Filtering searches all plugins, not just the current page, and resets to the first matching page. A filtered count appears only while filtering, or **No matching plugins** when none match. Selecting a marketplace focuses the plugin filter; selecting a plugin focuses **1 Add marketplace**. The action buttons follow the cards, without a repeated description. Choosing a plugin updates the highlighted selection and install and chat links without changing your search results. Selecting a different search result resets that choice.

The action buttons show the marketplace name for **Add marketplace** and the selected plugin name for **Install plugin** and **Ask “What can you do?”**. Selecting a marketplace or plugin highlights **1 Add marketplace** as the first step; the highlight clears when that step is marked done on returning from its launch tab.

Marketplace and plugin identifiers come from manifest contents, not repository names. The site checks `.claude-plugin/marketplace.json`, then `.github/plugin/marketplace.json`, on each repository's default branch. Unauthenticated GitHub search allows about 10 API searches per minute, and each page search uses up to three (manifest checks don't count toward it). If the limit is reached, the page counts down and retries automatically. Loading, loading, empty manifests, and errors are shown on the page.

The page cannot detect installation success or force plugin activation. The documented session endpoint requires a repository and has no plugin-binding parameter, so sessions always open in `apiarya/run-in-copilot` and the opening prompt requests the plugin by its `plugin@marketplace` identifier.

## Share a search

Add a URL-encoded search term as the `q` query parameter to open and run a search automatically:

- https://apiarya.github.io/run-in-copilot/?q=work-iq
- https://apiarya.github.io/run-in-copilot/?q=clinical-trial
- https://apiarya.github.io/run-in-copilot/?q=anthropics%2Flife-sciences

Searching also updates the address bar, so you can copy its URL to share the current query. The same links work locally with `http://localhost:8000/` as the base URL. Empty or whitespace-only `q` values leave the home page open without searching. Sharing a query does not change search coverage or guarantee that a plugin will be found.

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
