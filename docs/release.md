# Releasing — versioning, packaging, CI

**Load when:** packaging the extension, bumping versions, cutting a release, or editing the
CI / release workflows. Store-listing and first-publication steps for the human live in
[chrome-web-store.md](chrome-web-store.md).

## Versioning policy (semver)

`public/manifest.json` and `package.json` share one version, bumped together, never by hand
mid-release (`npm run release` does it). Standard semver:

- **patch** (`X.Y.Z+1`) — bug fixes, copy tweaks, no behavior or permission changes.
- **minor** (`X.Y+1.0`) — new backward-compatible features.
- **major** (`X+1.0.0`) — breaking changes, removed features, or new **required** permissions
  (users must re-consent, so treat added required host access as major).

Chrome Web Store requires the version to strictly increase on every upload; a resubmit at the
same version is rejected.

## Two manifests, one file

There is a single source of truth: **`public/manifest.json`**, written the way the **store**
wants it — broad host access declared as `optional_host_permissions` so a store install
prompts for nothing up front (lowest install friction; recommend requesting host access this
way). The catch: native permission prompts can't be accepted over CDP, so the **dev** build
(`tools/build.mjs`, default) rewrites `optional_host_permissions` → required `host_permissions`
in `dist/` so the dev browser has access without a prompt. The **store** build
(`tools/build.mjs --store`, used by `npm run package`) skips the rewrite and ships the manifest
verbatim.

## `npm run package` — anatomy

```
npm run package
```

1. **Store-variant build** — `tools/build.mjs --store` → `dist/` (no permission rewrite).
2. **Manifest-derived sanity checks** — asserts `manifest.json` is present and valid, the
   declared icons and page/script paths actually exist in `dist/`, and the manifest version
   matches `package.json`. Any failure exits non-zero before a zip is produced.
3. **Zip of `dist/` contents** — `manifest.json` at the **zip root** (what the store and Load
   Unpacked expect), written to `release/<slug>-v<version>.zip`. Cross-platform:
   `Compress-Archive` on Windows, `zip(1)` elsewhere — so a Linux CI runner produces the
   identical artifact.

## `npm run release` — the pipeline

```
npm run release -- patch                 # or  minor | major | X.Y.Z
npm run release -- patch notes.md        # with a hand-written notes file
```

The argument is positional: a bump word (`patch`/`minor`/`major`) or an exact `X.Y.Z`, and
optionally a path to an existing release-notes file. `tools/release.mjs` runs the whole cycle:

1. **Preflight** — working tree clean, on `main`, synced with origin, target tag free.
2. **Bump** — writes the new version into `public/manifest.json` **and** `package.json`
   together.
3. **Package** — runs `npm run package` (store build + sanity checks → the release zip).
4. **Commit** — `Release vX.Y.Z` (the pre-commit hook runs the full gate; never `--no-verify`).
5. **Tag** — `vX.Y.Z`.
6. **Push** — main + tag pushed atomically, which triggers `release.yml`.
7. **Report** — if the `gh` CLI is present, it watches the workflow run and prints the Release
   URL; without `gh` it still completes (it just can't watch/report the run).

### Preflight failures & fixes

| Failure                | Meaning                           | Fix                                         |
| ---------------------- | --------------------------------- | ------------------------------------------- |
| working tree not clean | uncommitted changes               | commit or stash, then re-run                |
| not on `main`          | releasing off a feature branch    | `git switch main` (merge your work first)   |
| behind/ahead of origin | local `main` out of sync          | `git pull --ff-only` (or push) until synced |
| tag already exists     | that version was already released | pick a higher version                       |
| gate fails at commit   | format/lint/types/tests red       | fix the failure — never bypass the hook     |

## CI workflows

- **`ci.yml`** — runs the full **gate** (`format:check` + `lint` + `typecheck` + `vitest`) on
  every push and pull request. This is the always-on quality guard, independent of releases.
- **`release.yml`** — **tag-driven**. On a pushed `vX.Y.Z` tag it re-runs the gate, builds and
  packages, enforces a **version-match guard** (the tag `vX.Y.Z` must equal
  `manifest.json`'s version, else the run fails), and publishes a **GitHub Release** with the
  `release/<slug>-vX.Y.Z.zip` attached.
- **Dry run** — trigger `release.yml` via **`workflow_dispatch`**: it gates and packages but
  publishes nothing, uploading the zip only as a workflow **artifact**. Use this to verify the
  pipeline without cutting a real release.

### When `release.yml` fails

- **Version-match guard failed** — the tag and manifest disagree. This almost always means a
  tag was pushed without the matching bump; delete the bad tag (`git tag -d vX.Y.Z` +
  `git push origin :vX.Y.Z`) and re-run `npm run release` so the bump and tag are created
  together.
- **Gate failed in CI** — reproduce locally with `npm run gate`, fix, and cut a new patch.
  A failed release run publishes nothing, so there's nothing to roll back — just release again.
- **Zip/asset upload failed** — check the workflow logs; the packaged zip is deterministic, so
  re-running the job on the same tag reproduces the same artifact.

## Icons & store assets checklist

Before a first publication (or when artwork changes) the human needs the assets listed in
[chrome-web-store.md](chrome-web-store.md): a required 128×128 icon, an optional 440×280 promo
tile, and at least one 1280×800 (or 640×400) screenshot, plus listing copy, category, and
privacy disclosures. The agent can generate the images and draft all listing text; the human
only does the dashboard upload. See [chrome-web-store.md](chrome-web-store.md) for the full,
step-by-step publication guide.
