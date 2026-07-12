# Architecture

**Maintained by the agent. Update this on every structural change** — a new module, a new
message type, a changed storage shape, a new permission. This doc is how the _next_ session (or
the next agent) understands the extension without re-reading all of `src/`. Keep it current;
a stale architecture doc is worse than none.

Sections below marked **(TEMPLATE — fill in)** are placeholders for the extension you build.
Replace the guidance text with the real thing as the extension takes shape.

## Scaffold — current state (as shipped by the template)

The template starts as a minimal but complete MV3 extension:

- **`src/background.ts`** — the service worker (MV3 background). Hosts a **typed message
  protocol**: it listens for messages and dispatches on a discriminated `type` field. The
  message shapes and the request/response types live in **`src/lib/messages.ts`** — the single
  source of truth shared by the SW and every page that talks to it. Ships with a `ping` handler
  the smoke test round-trips.
- **`src/popup/`** — the browser-action popup (its `popup.ts` entry plus any UI modules). This
  is the default surface a user sees; extend or replace it for your extension's UI.
- **`src/lib/`** — shared, page-agnostic modules (`messages.ts` today). Put pure logic and
  shared types here so both the SW and the UI import one copy.
- **`public/`** — static assets copied verbatim into `dist/`: `manifest.json`, `popup.html`,
  icons. Anything here ships as-is.
- **Build convention** — esbuild bundles **one entry point per page/context** (`background.ts`,
  `popup/popup.ts`, …) into `dist/`, and `public/` is copied over the top. To add a page,
  create its `src/<page>/<page>.ts` entry + a `public/<page>.html` that loads the bundled
  script, and register the entry in `tools/build.mjs`. **Content scripts must be bundled as
  IIFE, not ESM** (Chrome injects them into the page world, which has no module loader);
  `tools/build.mjs` has a documented pattern for adding one.

## Purpose _(TEMPLATE — fill in)_

> One paragraph: what this extension does and for whom. State the **single purpose** (the
> Chrome Web Store requires it, see `chrome-web-store.md`). This anchors every scope decision
> below — if a feature doesn't serve this purpose, it doesn't belong.

## Module map _(TEMPLATE — fill in)_

> A table of the real modules under `src/` and what each owns. Record it so the next agent
> knows where a concern lives without grepping. Keep it to responsibilities, not line-by-line.

| Module                    | Responsibility                   |
| ------------------------- | -------------------------------- |
| `src/background.ts`       | service worker; message dispatch |
| `src/lib/messages.ts`     | typed message protocol (shared)  |
| `src/popup/`              | popup UI                         |
| _(add rows as you build)_ |                                  |

## Data flow _(TEMPLATE — fill in)_

> Trace the main path end to end: user action in the UI → message (`src/lib/messages.ts`) →
> service-worker handler → storage/network/compute → response → UI update. Record it so
> anyone can follow a request without reverse-engineering it. Note any async/long-running work
> and where it lives (the SW can be evicted — say what survives eviction).

## Storage schema _(TEMPLATE — fill in)_

> Every persisted key: which storage area (`chrome.storage.local` / `session` / `sync` /
> IndexedDB), the value shape, and its lifecycle (when written, when cleared, migration on
> version bump). This matters because storage is the one thing that outlives code reloads and
> updates — get the shape wrong and users carry corrupt state across versions.

## Permissions rationale _(TEMPLATE — fill in)_

> Every entry in `manifest.json` `permissions` / `host_permissions` /
> `optional_host_permissions`, and the one-line reason each is needed. This is load-bearing
> twice: it's the source for the store's per-permission justifications, and it's the checklist
> that keeps scope from creeping (an unjustifiable permission is a rejection and a red flag).
> Prefer `optional_host_permissions` for broad host access — see `release.md` for why.
