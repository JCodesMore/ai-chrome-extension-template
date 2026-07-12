# AI Chrome Extension Template

<a href="https://github.com/JCodesMore/ai-chrome-extension-template/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a> <a href="https://github.com/JCodesMore/ai-chrome-extension-template/stargazers"><img src="https://img.shields.io/github/stars/JCodesMore/ai-chrome-extension-template?style=flat" alt="Stars" /></a>

Make any Chrome extension with AI agents. Describe what you want, run `/chrome-extension`,
and your AI agent plans it, builds it, tests it in a real browser it fully controls,
iterates until it works, and packages a release ready for the Chrome Web Store — end to
end, without you touching the browser.

**Recommended: [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — but
[Codex CLI](https://github.com/openai/codex) is fully supported too.**

The trick is the feedback loop. This template ships the same autonomous dev loop used to
build and ship a real production extension: the agent launches its own isolated browser
(Chrome for Testing, downloaded automatically), loads your extension, reloads it after
every change with error-log gating so failures surface immediately with the real error,
runs smoke tests, takes screenshots to check its own work, and cuts versioned releases —
all from the command line, no human clicking required.

## Quick Start

> **Important:** Start by making your own copy with GitHub's **Use this template** button.
> Do not clone this template repository directly for your extension project.

1. **Create your own repository from this template**

   On the GitHub page for this project, click **Use this template**, then **Create a new
   repository**. Name it after your extension idea, choose public or private, and create
   it.

2. **Open your new repository on your computer**

   ```bash
   git clone https://github.com/YOUR-USERNAME/YOUR-NEW-REPOSITORY.git
   cd YOUR-NEW-REPOSITORY
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Start your AI agent** — Claude Code recommended:

   ```bash
   claude
   ```

5. **Run the skill with your idea**:

   ```
   /chrome-extension a pomodoro timer that blocks distracting sites during focus sessions
   ```

6. **Answer a question or two if asked, then let it work.** The agent brings up its dev
   browser, plans the build, and iterates feature by feature — testing and screenshotting
   as it goes. When it's done you get a working extension, a release zip, and simple
   instructions for putting it on the Chrome Web Store if you want to.

> Using Codex? The same skill ships at `.agents/skills/` and `.codex/skills/` — type your
> idea after invoking the `chrome-extension` skill, or just tell Codex what you want; it
> picks up `AGENTS.md` automatically. See `docs/codex-setup.md` for sandbox notes.

## Supported platforms

| Agent                                                         | Status          |
| ------------------------------------------------------------- | --------------- |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | **Recommended** |
| [Codex CLI](https://github.com/openai/codex)                  | Supported       |

Other agents that read `AGENTS.md` and the open
[Agent Skills](https://agentskills.io) standard will mostly work, but only the two above
are tested.

## Prerequisites

- [Node.js](https://nodejs.org/) 22+
- An AI coding agent (see above)
- No Chrome setup needed — the agent downloads its own isolated
  [Chrome for Testing](https://developer.chrome.com/blog/chrome-for-testing) on first run
  (~200–300 MB, one time). Your personal browser is never touched.

## How it works

The `/chrome-extension` skill runs the full lifecycle:

1. **Spec** — turns your idea into an explicit spec and a minimal-permissions plan; asks
   at most a few sharp questions if a decision is genuinely yours to make
2. **Plan** — breaks the build into small tasks, each with a named verification
3. **Build loop** — for every task: edit → build + reload into the live dev browser →
   run checks → screenshot → quality gate (format, lint, types, tests) → commit
4. **Verify** — walks the whole user journey in the browser, tests fresh-install and
   edge cases, grows the smoke suite to cover every feature
5. **Release** — generates icons and store-listing copy, packages a Web-Store-ready zip,
   and (if you want) pushes to GitHub with a tagged release built by CI
6. **Handoff** — human-readable steps for the Chrome Web Store dashboard; the agent
   prepares everything, you do the final clicks

Every reload clears the browser's stale extension errors first, so when something breaks
the agent sees exactly what its last change caused — that closed feedback loop is what
lets it work unattended.

## Commands

```bash
npm run browser   # launch the agent's dev browser (isolated profile + CDP)
npm run reload    # build + hot-reload the extension, failing loudly on load errors
npm run smoke     # end-to-end smoke checks + popup screenshot
npm run gate      # format check + lint + typecheck + unit tests
npm run package   # build a Chrome-Web-Store-ready zip into release/
npm run release -- patch|minor|major   # version bump + tag + GitHub release
npm run stop      # close the dev browser
```

## Project structure

```
src/                  # TypeScript extension source (strict mode)
  background.ts       # MV3 service worker
  popup/              # popup UI
  lib/                # pure, unit-tested logic
public/               # manifest.json + static pages, copied into the build
tools/                # the dev loop: browser launch, CDP, reload, smoke, package, release
docs/                 # runbooks the agent loads on demand + docs it maintains for you
.claude/skills/       # the /chrome-extension skill (source of truth)
.agents/, .codex/     # generated skill copies for Codex (npm run sync)
AGENTS.md             # agent operating manual (all agents)
CLAUDE.md             # Claude Code config (imports AGENTS.md)
```

## Releasing to the Chrome Web Store

`npm run release` gives you a tagged GitHub release with the extension zip attached
(built and verified by CI). Publishing to the store is a short manual step by design —
Google requires a developer account (one-time $5) and a dashboard upload. The agent
prepares the zip, the listing text, screenshots, and permission justifications;
[docs/chrome-web-store.md](docs/chrome-web-store.md) walks you through the rest in a few
minutes.

## Not intended for

- **Malware, spyware, or deceptive extensions** — extensions that mislead users, collect
  data covertly, or violate the
  [Chrome Web Store policies](https://developer.chrome.com/docs/webstore/program-policies)
- **Circumventing website terms of service** — check before you scrape or automate

## License

MIT
