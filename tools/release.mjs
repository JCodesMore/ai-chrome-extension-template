// One-command release cycle. Usage:
//   npm run release -- patch|minor|major|X.Y.Z [notes-file]
//
// Arguments are positional and order-independent: a bump word (or exact
// version) picks the version, a path to an existing file becomes the release
// notes. No flags — npm and PowerShell both eat "--"-style flags on the way
// through ("--" itself is stripped by PowerShell, then npm claims --foo).
//
// Does the whole thing: preflight (clean main, synced with origin, tag free) →
// version bump in public/manifest.json + package.json/package-lock.json →
// `npm run package` (store build + sanity checks → release/<slug>-vX.Y.Z.zip,
// the Chrome Web Store upload) → commit (pre-commit hook runs the full gate) →
// tag → atomic push → watch .github/workflows/release.yml publish the GitHub
// Release → apply the notes if given.
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from './config.mjs';
import { slug } from './slug.mjs';

const RUN_APPEAR_TIMEOUT_MS = 60_000; // tag push → workflow run visible in the API
const RUN_POLL_MS = 3_000;

const git = (...args) => execFileSync('git', args, { cwd: CONFIG.root, encoding: 'utf8' }).trim();
const gitLive = (...args) => execFileSync('git', args, { cwd: CONFIG.root, stdio: 'inherit' });
// npm on Windows is npm.cmd, which Node refuses to spawn without a shell; every
// value interpolated below is validated first (semver regex), never free text.
const npm = (cmd) => execSync(`npm ${cmd}`, { cwd: CONFIG.root, stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) {
  console.error(`\nRELEASE ABORTED: ${msg}`);
  process.exit(1);
}

// --- arguments -------------------------------------------------------------
let bump = null;
let notesFile = null;
for (const a of process.argv.slice(2)) {
  if (a === '--notes') continue; // tolerated if a shell lets it through
  if (['patch', 'minor', 'major'].includes(a) || /^\d+\.\d+\.\d+$/.test(a)) bump = a;
  else if (existsSync(resolve(CONFIG.root, a))) notesFile = resolve(CONFIG.root, a);
  else fail(`unknown argument "${a}" — not a bump (patch|minor|major|X.Y.Z) or an existing file`);
}
if (!bump) fail('usage: npm run release -- patch|minor|major|X.Y.Z [notes-file]');

const manifestPath = resolve(CONFIG.root, 'public/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const current = manifest.version;

let next;
if (/^\d+\.\d+\.\d+$/.test(bump)) {
  next = bump;
} else {
  const [maj, min, pat] = current.split('.').map(Number);
  next =
    bump === 'major'
      ? `${maj + 1}.0.0`
      : bump === 'minor'
        ? `${maj}.${min + 1}.0`
        : bump === 'patch'
          ? `${maj}.${min}.${pat + 1}`
          : fail(`unknown bump "${bump}" — use patch, minor, major, or X.Y.Z`);
}
if (next === current) fail(`version is already ${current}`);
const tag = `v${next}`;

// --- preflight: refuse anything the pipeline can't recover from cleanly -----
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('releases cut from main only');
if (git('status', '--porcelain') !== '') fail('working tree not clean — commit or stash first');
gitLive('fetch', 'origin', 'main');
if (git('rev-list', '--count', 'HEAD..origin/main') !== '0')
  fail('main is behind origin/main — pull first');
try {
  git('rev-parse', '-q', '--verify', `refs/tags/${tag}`);
  fail(`tag ${tag} already exists`);
} catch {
  /* good — tag is free */
}
let hasGh = true;
try {
  execFileSync('gh', ['--version'], { stdio: 'ignore' });
} catch {
  hasGh = false;
  console.warn('gh CLI not found — will push the tag and let CI publish, but cannot watch it.');
}

// --- bump both version sources together --------------------------------------
console.log(`\n${current} → ${next}`);
manifest.version = next;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
// JSON.stringify expands arrays that prettier keeps inline — reformat to the
// house style or the pre-commit gate rejects the release commit.
npm('exec -- prettier --write public/manifest.json');
npm(`version --no-git-tag-version ${next}`); // package.json + package-lock.json

// --- build + validate the exact bytes that ship, BEFORE committing anything --
// Produces release/<slug>-vX.Y.Z.zip — the Chrome Web Store upload — and proves
// the store build is sane. CI builds the identical zip for the GitHub Release.
npm('run package');

// --- commit (the pre-commit hook runs the full gate) → tag → atomic push -----
gitLive('add', 'public/manifest.json', 'package.json', 'package-lock.json');
gitLive('commit', '-m', `Release ${tag}`);
gitLive('tag', tag);
gitLive('push', '--atomic', 'origin', 'main', `refs/tags/${tag}`);

// --- hand off to CI and watch it publish -------------------------------------
const zipName = `${slug(manifest.name)}-${tag}.zip`;
const repoUrl = git('remote', 'get-url', 'origin').replace(/\.git$/, '');
if (!hasGh) {
  console.log(`\nTag pushed. Watch the release publish at ${repoUrl}/actions`);
  process.exit(0);
}

let runId = null;
for (let waited = 0; waited < RUN_APPEAR_TIMEOUT_MS && !runId; waited += RUN_POLL_MS) {
  const runs = JSON.parse(
    execFileSync(
      'gh',
      [
        'run',
        'list',
        '--workflow=release.yml',
        '--event=push',
        '--limit=10',
        '--json',
        'databaseId,headBranch',
      ],
      { cwd: CONFIG.root, encoding: 'utf8' },
    ),
  );
  runId = runs.find((r) => r.headBranch === tag)?.databaseId ?? null;
  if (!runId) await sleep(RUN_POLL_MS);
}
if (!runId) fail(`tag pushed but no release.yml run appeared — check ${repoUrl}/actions`);

execFileSync('gh', ['run', 'watch', String(runId), '--exit-status'], {
  cwd: CONFIG.root,
  stdio: 'inherit',
});

if (notesFile) {
  execFileSync('gh', ['release', 'edit', tag, '--notes-file', notesFile], {
    cwd: CONFIG.root,
    stdio: 'inherit',
  });
}

const releaseUrl = execFileSync('gh', ['release', 'view', tag, '--json', 'url', '--jq', '.url'], {
  cwd: CONFIG.root,
  encoding: 'utf8',
}).trim();

console.log(`\nRELEASE ${tag} COMPLETE`);
console.log(`  GitHub : ${releaseUrl}  (public download: ${zipName})`);
console.log(`  CWS    : upload release/${zipName} (same bytes) — see docs/chrome-web-store.md`);
