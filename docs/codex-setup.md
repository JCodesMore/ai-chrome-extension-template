# Running this template under Codex CLI

**Load when:** the agent operating this repo is **Codex CLI** (OpenAI) rather than Claude Code,
or when the `/chrome-extension` skill needs regenerating. Everything else in `docs/` is
agent-agnostic; this file covers only the Codex-specific wiring and one important sandbox
gotcha.

## AGENTS.md is auto-read

Codex CLI reads **`AGENTS.md`** from the repo root automatically at session start (default cap
**32 KiB**). The routing table in `AGENTS.md` is the entry point — keep it and the always-on
rules lean so they fit comfortably under the cap, and let the routed `docs/` carry the detail
(they're read on demand, not counted against the startup budget).

## The `/chrome-extension` skill

The canonical skill lives at **`.claude/skills/chrome-extension/SKILL.md`**. Codex discovers
skills from its own paths, so the repo ships generated copies:

- `.agents/skills/chrome-extension/SKILL.md`
- `.codex/skills/chrome-extension/SKILL.md`

These are **generated copies**, not hand-maintained. Edit only the canonical
`.claude/skills/chrome-extension/SKILL.md`, then regenerate the copies:

```
npm run sync
```

The template duplicates the file rather than symlinking it because symlinks are unreliable on
Windows (see [decisions.md](decisions.md)). **If a Codex version doesn't auto-discover repo
skills**, tell it to read `.codex/skills/chrome-extension/SKILL.md` (or the canonical path)
directly — the content is identical.

## Recommended run configuration

Run Codex with workspace write access and on-request approvals:

```
codex --sandbox workspace-write --ask-for-approval on-request
```

and enable network access for the sandbox in `config.toml` (needed for the first-run Chrome
for Testing download and for `npm`):

```toml
[sandbox_workspace_write]
network_access = true
```

## Known limitation: the sandbox can block the CDP port

**This is the one thing that reliably breaks the dev loop under Codex.** The Codex sandbox may
block local `listen()` sockets. The dev browser needs to bind its remote-debugging port
(`CDP_PORT`, default 9222) to accept CDP connections — if the sandbox denies the listen, Chrome
can't open the port and `npm run browser` fails, typically with a **`listen EPERM`** (or
similar bind-permission) error.

If you hit this, pick one of:

- **Approve the command outside the sandbox** — when Codex prompts (on-request approval), let
  `npm run browser` (and the rest of the dev loop) run outside the sandbox so Chrome can bind
  the port.
- **Run with full access in a disposable environment** — `codex --sandbox
danger-full-access` inside a throwaway container/VM you don't mind giving broad access to.
  Only do this in an environment built to be thrown away.

Once the browser is up and the port is bound, the rest of the loop (`reload`, `smoke`, the
`tools/*.mjs` diagnostics) behaves identically to Claude Code — it's all CDP over that one
port. See [dev-loop.md](dev-loop.md) for the loop itself.
