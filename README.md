# Run in Copilot

A single-page, browser-only launcher for public GitHub marketplace plugins in the GitHub Copilot desktop app.

**Site:** https://apiarya.github.io/run-in-copilot/

## Use it

1. Choose Life Sciences or Work IQ, or enter a public GitHub repository as `owner/repository` or a repository URL. Select **Run in GitHub Copilot** to add the marketplace; plugins load automatically.
2. Pick a plugin from the marketplace manifest and select **Install plugin in GitHub Copilot**. Each button opens Copilot's confirmation form; confirm the action in the app.
3. Enter your own target repository, then select **Ask “What can you do?”** to open an interactive session requesting the selected plugin.

Marketplace and plugin identifiers come from manifest contents, not repository names. The site resolves the repository's default branch and checks `.claude-plugin/marketplace.json`, then `.github/plugin/marketplace.json` if the first path is absent. Public GitHub API rate limits apply, and loading, empty manifests, and errors are shown on the page.

The page cannot detect installation success or force plugin activation. The documented session endpoint requires a target repository and has no plugin-binding parameter; the opening prompt requests the plugin by its `plugin@marketplace` identifier. The target is never prefilled with the marketplace repository.

## Local development

No dependencies or build step are required. With Node.js 22+ and Python 3:

```sh
npm test
npm run serve
```

Open http://localhost:8000. Serve over HTTP rather than opening `index.html` directly, so browser modules load correctly.

## Deployment

In repository **Settings → Pages**, select **GitHub Actions** as the source. Push to `main` to run `.github/workflows/pages.yml`, which runs the tests and deploys only the static site assets. The workflow can also be started manually. No tokens, secrets, package installation, or backend are required.

## Privacy and trust

Repository and manifest requests go directly from your browser to `api.github.com` and `raw.githubusercontent.com`; there is no analytics or local storage. Manifest text is rendered as text, never HTML, and no marketplace code is executed by this site. Review marketplaces and plugins before installing them. Repository access remains governed by Copilot and GitHub when opening a session.

App links follow the [official Copilot deep-link documentation](https://docs.github.com/en/copilot/how-tos/github-copilot-app/open-with-deep-links): query values are encoded first, then the entire `ghapp://` link is encoded inside `https://github.com/copilot/app/launch?open=…`.

This is an independent project, not affiliated with GitHub.
