# The dev loop — driving & verifying the extension

**Load when:** running the extension in the dev browser, adding diagnostics, extending smoke
checks, driving the UI over CDP, or debugging the dev browser / CDP tooling itself. The core
loop commands and the hard rules that bind every command here (never touch the user's own
browser; never hardcode the extension ID) live in `AGENTS.md`.

## The core loop

Every iteration is the same four beats:

```
edit src/…              # change code
npm run reload          # BUILD (esbuild → dist/) + reload the extension in the dev browser
npm run smoke           # e2e: browser up, extension enabled, popup opens, SW ping, DOM sanity
open tools/screenshots/smoke-popup.png   # look at what the popup actually rendered
```

Keep the browser running across iterations — `npm run browser` is idempotent, so a stray
re-run is harmless, but you rarely need it after the first launch. Reload is fast because it
never restarts the browser; it rebuilds `dist/` and hot-reloads the unpacked extension in
place. Look at the screenshot every loop: a green smoke run tells you the plumbing works, the
image tells you the feature looks right.

## What each command does + exit codes

| Command                                            | Does                                                                                                                                                                                                                                                                                                                                                                                                                                               | Exit codes                                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm run browser`                                  | Launch/attach the dev browser (idempotent). First run downloads Chrome for Testing into gitignored `.browser/` via `@puppeteer/browsers` (~200–300 MB, one-time), then launches with an isolated `--user-data-dir=.dev-profile`, `--remote-debugging-port`, `--enable-unsafe-extension-debugging`, `--load-extension=dist`. Ensures `dist/` is loaded (CDP `Extensions.loadUnpacked` fallback). Prints JSON status including the **extension ID**. | `0` up & loaded; non-zero on launch/attach failure                                                                                 |
| `npm run reload`                                   | Build `dist/` then reload the extension via `chrome.developerPrivate` over CDP. Clears the sticky error log first, then re-checks `manifestErrors`/`runtimeErrors`/state.                                                                                                                                                                                                                                                                          | `0` reloaded clean; `1` new code failed to load (prints the real error JSON); `2` browser/extension not up — run `npm run browser` |
| `npm run smoke`                                    | e2e checks: browser up, extension **ENABLED**, popup opens, SW **ping** round-trip, popup DOM sanity, screenshot to `tools/screenshots/smoke-popup.png`. Extend it per feature (see below).                                                                                                                                                                                                                                                        | `0` all pass; non-zero on first failed assertion                                                                                   |
| `node tools/shot.mjs [page.html] [--out name.png]` | Screenshot any extension page (defaults to the popup).                                                                                                                                                                                                                                                                                                                                                                                             | non-zero if the page/target can't be opened                                                                                        |
| `node tools/send.mjs '{"type":"ping"}'`            | Send an arbitrary message to the service worker; print the JSON response.                                                                                                                                                                                                                                                                                                                                                                          | non-zero if the SW doesn't respond                                                                                                 |
| `npm run gate`                                     | `format:check` + `lint` + `typecheck` + `vitest`. Pre-commit hook.                                                                                                                                                                                                                                                                                                                                                                                 | `0` all green; non-zero on first failing stage                                                                                     |
| `npm run stop`                                     | Close the dev browser via CDP `Browser.close` on the configured port only.                                                                                                                                                                                                                                                                                                                                                                         | `0` on clean close                                                                                                                 |

**Exit codes are ground truth.** A command's own exit code is the source of truth for
pass/fail — not stdout scraping, not "it looked fine." If `reload` exits `1`, the new code did
not load; read the printed error JSON and fix it before continuing.

## Error monitoring & the audit trail

Chrome accumulates extension errors across loads and shows stale ones long after the offending
code is gone. The tooling defeats this with a **clear-then-check** pattern:

1. **Clear** the extension's error log via `chrome.developerPrivate` before reloading.
2. **Reload** the freshly built `dist/`.
3. **Check** `manifestErrors`, `runtimeErrors`, and the enabled/disabled `state` that Chrome
   reports _after_ the reload.

Because the slate is wiped first, any error `reload` reports belongs to the code you just
built — no ghosts. Manifest errors (bad `manifest.json`, invalid permissions) surface here as
load failures; service-worker runtime errors surface both here and via `node tools/send.mjs`
returning no/'error' responses. `smoke` is the broader net: it drives the popup and SW the way
a user would and fails loudly on the first broken assertion.

## Driving the UI over CDP

There is **no official CDP "reload extension" command** and no official high-level extension
UI API — everything is done by opening a page target and evaluating JavaScript on it. The
generic skeleton for any UI check:

```
findExtension()                         → the path-derived extension ID
createTab(chrome-extension://<id>/popup.html)   → open the page as a real tab
evalOnTarget(tab, "<expr>")             → drive inputs / read the DOM to assert
screenshot(tab, "tools/screenshots/<name>.png")
closeTab(tab)
```

Concrete example (a standalone diagnostic script using the `tools/cdp.mjs` helpers):

```js
// tools/ui-search.mjs — assert typing a query renders at least one result row
import { findExtension, createTab, evalOnTarget, screenshot, closeTab } from './cdp.mjs';

const { id } = await findExtension();
const tab = await createTab(`chrome-extension://${id}/popup.html`);
try {
  await evalOnTarget(
    tab,
    `
    const input = document.querySelector("#query");
    input.value = "hello";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  `,
  );
  const count = await evalOnTarget(tab, `document.querySelectorAll(".result").length`);
  await screenshot(tab, 'tools/screenshots/ui-search.png');
  if (count < 1) {
    console.error('no results rendered');
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, count }));
} finally {
  await closeTab(tab);
}
```

Extension pages are privileged: JS evaluated on a `chrome-extension://` target has the full
`chrome.*` extension API surface (`chrome.storage`, `chrome.runtime`, `chrome.tabs`, …), so
the same `evalOnTarget` primitive both drives the UI and seeds/reads extension state.

## Writing new diagnostic scripts in `tools/`

**Convention: one small script per concern, exit non-zero on failure.** Each check is its own
`tools/<name>.mjs`, prints a one-line JSON result on success, and `process.exit(1)` on any
failed assertion so the agent (and CI) can treat it as a gate. Import the primitives from
`tools/cdp.mjs`; keep the script under a screenful. Prefer many focused scripts
(`ui-search.mjs`, `ui-settings.mjs`, `storage-check.mjs`) over one mega-harness — they compose,
they're easy to reason about, and a failing one names the exact broken concern.

## Extending smoke checks per feature

`tools/smoke.mjs` ships with generic assertions (browser up, extension enabled, popup opens,
SW ping, DOM sanity, screenshot). **As you build a feature, add an assertion for it here** so
the core loop keeps proving the feature works. Add a real check, not a smoke-and-mirrors one:
drive the actual input, read the actual DOM/SW response, fail on the actual wrong value. When
smoke grows unwieldy, split feature-specific checks into their own `tools/ui-*.mjs` scripts and
keep smoke as the fast always-run baseline.

## Environment notes

- **`CDP_PORT`** (default `9222`) — the debugging port the dev browser listens on and every
  tool connects to. Override if `9222` is taken.
- **`BROWSER_EXE`** — skip the Chrome for Testing download and use a specific
  Chromium-family binary. It **must be a non-branded build** (Chromium, Chrome for Testing,
  or Brave). Pointing it at branded Chrome or Edge will silently fail to load the extension —
  see next note.
- **Branded Chrome 137+ can't do this.** Google removed `--load-extension` from _branded_
  Chrome and Edge in v137 (May 2025); it still works in Chrome for Testing and open-source
  Chromium, which is exactly why the template downloads Chrome for Testing by default (Google's
  officially recommended vehicle for this problem).
- **Isolated profile, on purpose.** Chromium 136+ also blocks `--remote-debugging-port` on the
  _default_ user-data-dir, and a profile can only be open in one process at a time. The dev
  loop therefore uses a throwaway `--user-data-dir=.dev-profile` (gitignored) — a fresh,
  isolated profile that exists only for the extension.
- **Two browsers, one rule.** The dev browser is the agent's to launch, drive, reload, and
  kill freely. The user's own personal browser and profile are **off-limits** — never attach
  to, reload, or close it. `npm run stop` only ever closes the dev instance on the configured
  CDP port.

## Troubleshooting

| Symptom                                                | Cause                                              | Fix                                                                                |
| ------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `listen`/port bind error, or tools can't connect       | Port `9222` already in use                         | Set `CDP_PORT` to a free port and re-run                                           |
| Tools report the extension is missing                  | Browser up but `dist/` not loaded                  | `npm run browser` (idempotent; re-runs the load)                                   |
| Chrome for Testing download fails / offline            | No network for `@puppeteer/browsers`               | Point `BROWSER_EXE` at a local non-branded Chromium build                          |
| `npm run reload` exits `1`                             | The freshly built code failed to load              | Read the printed error JSON — it's the real manifest/runtime error; fix and reload |
| `npm run reload` exits `2`                             | Browser/extension not up                           | `npm run browser` first, then reload                                               |
| Launch fails with a profile-lock / SingletonLock error | A stale dev browser still holds `.dev-profile`     | `npm run stop` first, then `npm run browser`                                       |
| Extension loads but nothing works, no errors           | `BROWSER_EXE` points at branded Chrome/Edge (137+) | Use Chrome for Testing / Chromium / Brave, or unset `BROWSER_EXE` to auto-download |

## How the tools fit together (`tools/`)

- **`cdp.mjs`** — the CDP helper library: target listing, `Runtime.evaluate` on any target,
  `chrome.developerPrivate.*` (list/reload/clear-errors/state) via a `chrome://extensions`
  page target, tab open/close, PNG screenshots. Import primitives from here for ad-hoc
  debugging: `findExtension()`, `createTab(url)`, `evalOnTarget(tab, expr)`,
  `screenshot(tab, file)`, `closeTab(tab)`.
- **`browser.mjs`** — launches/attaches the dev browser, downloads Chrome for Testing on first
  run, falls back to `Extensions.loadUnpacked` if `--load-extension` is ignored.
- **`build.mjs`** — bundles `src/` (esbuild, entry-point-per-page) + copies `public/` into
  `dist/`; the dev build rewrites optional host permissions to required so CDP suites never hit
  the native permission prompt (store build in `docs/release.md`).
- **`reload.mjs` / `smoke.mjs`** — the core loop; both exit non-zero on failure.
