---
name: chrome-extension
description: Build any Chrome MV3 extension end-to-end from a plain-language idea — plan, scaffold, develop against a live dev browser with a full feedback loop (build, reload, error gating, smoke checks, screenshots), then package, version, and release. Use whenever the user wants to create, build, make, or ship a Chrome extension or browser plugin. Also triggers on "make me an extension that...", "build a chrome plugin", "browser extension for...". Provide the extension idea as the argument.
argument-hint: '<describe the extension you want>'
user-invocable: true
---

# /chrome-extension — idea to shipped Chrome extension

You are about to take an idea — `$ARGUMENTS` — and turn it into a working, tested,
release-ready Chrome MV3 extension. This repo gives you a complete autonomous dev loop:
a dedicated dev browser you fully control over CDP, build + reload with error gating,
smoke tests, screenshots, a quality gate, and a one-command release pipeline. You never
need the human to click anything in a browser until the optional Chrome Web Store upload
at the very end.

Work autonomously. After Phase 1 locks the spec, do not stop to ask permission between
phases — report progress at phase boundaries and keep going. Stop only for genuine scope
decisions, destructive actions, or anything that publishes publicly (GitHub push, store
upload).

## Ground rules

1. **The loop is the law.** No change is "done" until it has been through:
   edit → `npm run reload` (exit 0) → a check that exercises it → screenshot when visual.
   `npm run reload` clears Chrome's sticky error log first, so any error it prints belongs
   to YOUR current code — read it, fix it, reload again.
2. **Small tasks, verified seams.** Break every phase into tasks smaller than your first
   instinct. Each task ends with a check you can actually run (a smoke assertion, a
   `tools/send.mjs` round-trip, a screenshot you inspect). Never batch three features into
   one reload.
3. **Evidence over memory.** Chrome extension APIs shift. Verify any API surface you're
   not 100% sure of against current documentation before building on it. Exit codes and
   screenshots are ground truth; "it should work" is not.
4. **Never touch the human's browser.** The dev browser (isolated `.dev-profile/`, CDP on
   its own port) is yours. Their personal Chrome, profiles, and data are off-limits.
5. **Minimal permissions, always justified.** Every `permissions` / `host_permissions`
   entry must be load-bearing and get a one-line justification in `docs/architecture.md`.
   Excess permissions are the #1 Chrome Web Store rejection reason. Prefer
   `optional_host_permissions` for broad host access (the build tooling handles the
   dev-time rewrite — see `docs/release.md`).
6. **Leave an audit trail.** Commit after every completed task (the pre-commit hook runs
   the full gate). Keep `docs/architecture.md` and `docs/decisions.md` current as you go —
   they are how a future session resumes cleanly.

## Phase 0 — Bring up the loop

Before anything else, prove the feedback loop works on this machine:

1. Read `AGENTS.md` (if not already in context) and `docs/dev-loop.md`.
2. `npm install` if `node_modules/` is missing. Then make sure the pre-commit gate is
   wired: `git config core.hooksPath .githooks` (safe to re-run).
3. `npm run browser` — first run downloads Chrome for Testing (~200–300 MB, one-time).
   Note the extension ID from the JSON output; never hardcode it.
4. `npm run reload` then `npm run smoke` — all checks must pass on the pristine scaffold.
   View `tools/screenshots/smoke-popup.png` to confirm the popup renders.
5. If any step fails, fix the environment first using the troubleshooting table in
   `docs/dev-loop.md` (port collision → `CDP_PORT`, download blocked → `BROWSER_EXE`,
   etc.). Do not start feature work on a broken loop.

## Phase 1 — Synthesize the idea into a spec

The user's idea may be a one-liner or a brain dump. Turn it into an explicit spec:

1. Extract: the job the extension does, who uses it, and the minimal surface that proves
   it works (popup? content script? options page? background-only? omnibox? side panel?).
2. Decide the MVP boundary: the smallest version that delivers the core job. Everything
   else goes to a "later" list.
3. Identify required Chrome APIs and permissions. Flag anything that needs broad host
   access or sensitive permissions.
4. **Only if a decision would change what you build** (ambiguous core job, two equally
   valid UX surfaces, a permission trade-off the user should own): ask up to 3 sharp
   questions, once, now. Otherwise choose sensible defaults, record them, and proceed.
5. Write the spec into `docs/architecture.md` (Purpose + Permissions rationale sections)
   and the MVP task list into your task tracker. Name the extension (short, descriptive;
   the user's wording wins if they gave one).

## Phase 2 — Plan the build

Produce an ordered task list where each task is one reload-loop iteration:

- Task 0 is always: rebrand the scaffold (manifest `name`/`description`, popup title,
  `docs/architecture.md` header) and verify via reload + smoke + screenshot.
- Then one task per capability, ordered so every task lands on a testable state:
  message contracts and storage schema before UI that consumes them; content-script
  injection proven with a trivial payload before real page logic rides on it.
- For each task, write down its check BEFORE building: which smoke assertion, message
  round-trip, or screenshot proves it. If you can't name the check, the task is too big —
  split it.
- Extension surfaces have build implications: each new HTML page gets an esbuild entry in
  `tools/build.mjs`; content scripts need the IIFE pattern documented there. Plan these
  edits as part of the task that introduces the surface.

## Phase 3 — Build, one loop iteration per task

For every task:

1. Implement the smallest change that completes the task. Keep the scaffold's structure:
   pure logic in `src/lib/` or `src/core/` (unit-testable, no chrome.* imports), thin
   chrome-API adapters at the edges, one folder per UI surface, message types in
   `src/lib/messages.ts`.
2. `npm run reload`. Exit 1 → read the printed error JSON, fix, repeat. Never proceed on
   a red reload.
3. Run the task's check: extend `tools/smoke.mjs` with a real assertion for the feature
   (this is mandatory for every user-visible capability), or use `node tools/send.mjs`
   for service-worker contracts, or write a small one-concern script in `tools/` for
   anything the generic helpers don't cover (`tools/cdp.mjs` gives you tabs, eval,
   screenshots — see the skeleton in `docs/dev-loop.md`).
4. Visual features: `node tools/shot.mjs <page>` and actually LOOK at the screenshot.
   Layout bugs, clipped text, and dark-mode breakage are only visible to eyes.
5. Unit-test pure logic with vitest alongside the source (`*.test.ts`).
6. `npm run gate` must be green, then commit with a message describing the capability.
7. Update `docs/architecture.md` when structure changed; append to `docs/decisions.md`
   when you chose between real alternatives.

If the service worker misbehaves silently (no error, wrong behavior), debug with
`node tools/send.mjs` round-trips and `chrome.storage`/state dumps via a diagnostic
script — do not guess-and-reload.

## Phase 4 — Verify the whole

When the MVP task list is done, verify the assembled product, not just the parts:

1. `npm run smoke` — the file should now assert every core capability. All green.
2. Walk the primary user journey end-to-end over CDP yourself (open the real surfaces,
   drive them, screenshot each step). Compare what you see against the Phase 1 spec,
   line by line.
3. Test the ugly paths: fresh install (`npm run stop`, delete `.dev-profile/`,
   `npm run browser` — does first-run behave?), missing permissions, empty states,
   very long inputs.
4. `npm run gate` green. Fix everything you find; re-verify what you fix.
5. Report to the user: what was built, screenshots, how each spec line is covered, the
   "later" list, and anything you decided on their behalf.

## Phase 5 — Release readiness

1. **Icons are required for the store**: the manifest needs at least a 128×128 icon
   (ship 16/32/48/128). Generate them (write a small script, or add a dev-only image
   dependency) from a simple, legible mark — or ask the user if they have art. Wire them
   into `public/manifest.json` (`icons` + `action.default_icon`), reload, screenshot the
   toolbar/popup to confirm.
2. Final manifest review: correct `name`, `description` (≤132 chars, store-facing),
   `version`, minimal permissions, no dev leftovers.
3. Prepare the store listing package for the human (they'll paste it into the dashboard):
   single-purpose statement, per-permission justifications, a longer description, and
   1280×800 screenshots (compose them from your CDP screenshots). Save under
   `docs/store-listing.md`.
4. `npm run package` — confirm the zip lands in `release/` and the sanity checks pass.

## Phase 6 — Ship

1. Ask the user: push to GitHub? If yes and no remote exists, create the repo (their
   choice of public/private) and push. Never push without an explicit yes.
2. Cut the release: `npm run release -- minor` (or the bump they want). This bumps
   manifest + package.json in lockstep, packages, commits, tags, pushes atomically, and
   GitHub Actions attaches the zip to a GitHub Release. Without a GitHub remote, the
   local zip in `release/` is the deliverable.
3. Hand over the Chrome Web Store steps: point the user at `docs/chrome-web-store.md`
   (account, one-time $5 fee, upload the zip, paste the listing package from
   `docs/store-listing.md`, submit). Offer to walk them through it.

## What NOT to do

- Don't develop against the human's installed Chrome, and don't reuse their profile.
- Don't hardcode the extension ID anywhere — it changes per machine and per path.
- Don't skip a red gate or bypass the pre-commit hook. Fix the cause.
- Don't request `<all_urls>` as a required permission when `optional_host_permissions`
  or `activeTab` does the job.
- Don't pile up three features between reloads — you lose the ability to attribute
  errors.
- Don't leave `tools/smoke.mjs` at scaffold level while shipping real features — smoke
  coverage must grow with the product.
- Don't hand-edit anything in `dist/` — it is build output.

## Completion report

End with: what was built (one paragraph), the final smoke/gate status, screenshots of
every surface, permission list with justifications, the release artifact path (and
GitHub Release URL if pushed), and the exact next click-by-click steps left for the
human (usually: Chrome Web Store upload per `docs/chrome-web-store.md`).
