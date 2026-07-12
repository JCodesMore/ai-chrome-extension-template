// Produce the Chrome Web Store upload: a store-manifest build of dist/,
// sanity-checked and zipped with manifest.json at the ZIP ROOT (CWS rejects
// nested-folder zips). Finishes by restoring the normal dev build so the dev
// browser's loaded dist/ keeps its dev host permissions.
// Usage: npm run package
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from './config.mjs';
import { slug } from './slug.mjs';

const BYTES_PER_MB = 1024 * 1024;

const dist = resolve(CONFIG.root, 'dist');
const releaseDir = resolve(CONFIG.root, 'release');
const node = process.execPath;

function fail(msg) {
  console.error(`PACKAGE FAILED: ${msg}`);
  process.exit(1);
}

console.log('building store variant…');
execFileSync(node, [resolve(CONFIG.root, 'tools/build.mjs'), '--store'], { stdio: 'inherit' });

// --- sanity checks on the exact bytes that would ship ---
// Everything is derived from the manifest itself — no hardcoded filenames — so
// these checks keep working as the extension grows.
const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.json'), 'utf8'));
const mustExist = (file, why) => {
  if (!existsSync(resolve(dist, file))) fail(`${why}: dist missing "${file}"`);
};

if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (!manifest.version) fail('manifest is missing a version');

if (manifest.background?.service_worker)
  mustExist(manifest.background.service_worker, 'background');
if (manifest.action?.default_popup) mustExist(manifest.action.default_popup, 'action popup');
for (const file of Object.values(manifest.icons ?? {})) mustExist(file, 'icon');
for (const file of Object.values(manifest.action?.default_icon ?? {}))
  mustExist(file, 'action icon');

const version = manifest.version;
mkdirSync(releaseDir, { recursive: true });
const zip = resolve(releaseDir, `${slug(manifest.name)}-v${version}.zip`);
rmSync(zip, { force: true });

// Zip the CONTENTS of dist (manifest at root), not the dist folder itself.
// Windows: Compress-Archive. Elsewhere (incl. the release CI runner): zip(1).
if (process.platform === 'win32') {
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path "${dist}\\*" -DestinationPath "${zip}"`,
  ]);
} else {
  execFileSync('zip', ['-qr', zip, '.'], { cwd: dist });
}

const mb = (statSync(zip).size / BYTES_PER_MB).toFixed(1);
console.log(`packaged: ${zip} (${mb} MB, v${version})`);

console.log('restoring dev build…');
execFileSync(node, [resolve(CONFIG.root, 'tools/build.mjs')], { stdio: 'inherit' });
console.log('done — dist/ is the dev build again; upload the zip from release/.');
