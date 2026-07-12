# Agent operating manual

> **This file is always in context — it stays lean.** Task-specific detail lives in `docs/`
> and is loaded on demand via the Routing table below. Load a doc only when its task
> applies.

## The project

This repo starts as a template and becomes a real Chrome MV3 extension: the user runs
`/chrome-extension <idea>` and you (the AI agent) build it end-to-end. If that skill is
not available in your harness, read `.claude/skills/chrome-extension/SKILL.md` and follow
it directly with the user's idea — it is the master workflow (plan → build → test →
package → release).

- `src/` — TypeScript extension source (strict; bundled by esbuild)
- `public/` — static assets (manifest.json, HTML pages) copied into the build
- `dist/` — built unpacked extension (gitignored; what the dev browser loads)
- `tools/` — Node dev-loop scripts (Node 22+; zero runtime deps)
- `docs/` — routed docs; `docs/architecture.md` and `docs/decisions.md` are YOURS to
  maintain as the extension takes shape

## The dev loop (every change runs through it)

```
npm run browser   # launch/attach the dev browser (first run downloads Chrome for Testing)
npm run reload    # BUILD + reload extension; exit 1 + the real error if new code fails to load
npm run smoke     # e2e checks + screenshot — extend tools/smoke.mjs as you add features
npm run gate      # format:check + lint + typecheck + tests (pre-commit hook runs this)
npm run stop      # cleanly close the dev browser
```

Standard iteration: **edit → `npm run reload` → check → view
`tools/screenshots/smoke-popup.png`**. Reload clears Chrome's sticky extension error log
first, so reported errors always belong to the current code. Ad-hoc probes:
`node tools/send.mjs '{"type":"ping"}'` (message the service worker),
`node tools/shot.mjs [page.html]` (screenshot any extension page). Full catalog:
`docs/dev-loop.md`.

## Hard rules

- **Never touch the user's personal browser** — not their Chrome, profiles, or data. The
  dev loop owns an isolated browser (`.dev-profile/`, its own CDP port). `npm run stop`
  only closes via that port.
- The unpacked extension ID is derived from the load path: stable on one machine, never
  portable. Read it from `npm run browser` output or `findExtension()` in
  `tools/cdp.mjs`; never hardcode it.
- Branded Chrome/Edge cannot side-load unpacked extensions (since v137). The dev browser
  is Chrome for Testing by default; `BROWSER_EXE` may point only at a non-branded
  Chromium-family build. Details: `docs/dev-loop.md`.
- Never commit secrets. Never hand-edit generated output (`dist/`, lockfiles).

## Working standards (always apply)

1. **Evidence over memory.** Verify Chrome APIs and library behavior against current docs
   or the installed source before building on them — training knowledge goes stale.
2. **Small tasks, verified seams.** Split work smaller than your first instinct; every
   task ends with a check you can run (reload exit code, smoke assertion, screenshot).
3. **The gate is law.** `npm run gate` green before every commit; the pre-commit hook
   enforces it — never bypass with `--no-verify`. No magic numbers in `src/`; files ≤500
   LOC; low coupling (pure logic in `src/lib/`–`src/core/`, chrome.* adapters at edges).
4. **Grow the tests with the product.** Every feature adds a smoke assertion; every pure
   function gets a colocated `*.test.ts`.
5. **Persist state against context loss.** Keep `docs/architecture.md` (module map,
   permissions rationale) and `docs/decisions.md` (choices + rejected alternatives)
   current; commit after every completed task so any future session resumes from git.
6. **Brief subagents fully.** They start with none of this context — name the exact doc
   paths they must read.

## Routing — load a doc ONLY when its task applies

| When your task involves…                                                                                      | Read                       |
| ------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Driving or verifying the extension in the dev browser (CDP, smoke, screenshots, diagnostics, troubleshooting) | `docs/dev-loop.md`         |
| Versioning, packaging, cutting a release, CI                                                                  | `docs/release.md`          |
| Chrome Web Store submission (human-facing guide)                                                              | `docs/chrome-web-store.md` |
| Understanding or changing the extension's structure                                                           | `docs/architecture.md`     |
| Recording or revisiting a design decision                                                                     | `docs/decisions.md`        |
| Running under OpenAI Codex (sandbox/network specifics)                                                        | `docs/codex-setup.md`      |

## Maintenance

After editing the canonical skill (`.claude/skills/chrome-extension/SKILL.md`), run
`npm run sync` to regenerate the `.agents/` and `.codex/` copies — never edit the copies.
