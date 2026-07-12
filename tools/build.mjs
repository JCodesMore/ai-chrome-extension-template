// Build the extension: bundle src/ entry points and copy public/ statics into dist/.
//
// Dev vs. store manifest: any host permissions the extension needs at runtime
// belong in optional_host_permissions in public/manifest.json (no scary install
// warning; the user grants them at consent time). But the native permission
// prompt can't be accepted over CDP, so the default dev build rewrites
// optional_host_permissions → required host_permissions — request() then
// resolves without a dialog and the e2e suites drive the same code paths.
// `--store` skips the rewrite (used by tools/package.mjs).
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from './config.mjs';

// One entry per extension page/worker. Add a line here when you add a new
// surface — an options page (src/options/options.ts), an offscreen document,
// a devtools panel, etc. Content scripts are the exception (see below).
const ENTRY_POINTS = ['src/background.ts', 'src/popup/popup.ts'];

// Content scripts must be bundled as `iife`, not `esm` — they run in the page's
// world where ES-module `import`/`export` isn't available. When you add one,
// list it here and it gets a second esbuild pass with format: 'iife'.
const CONTENT_SCRIPT_ENTRY_POINTS = [];

const storeBuild = process.argv.includes('--store');

const dist = resolve(CONFIG.root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const shared = {
  outdir: dist,
  entryNames: '[name]',
  bundle: true,
  target: 'chrome120',
  logLevel: 'warning',
};

await build({
  ...shared,
  entryPoints: ENTRY_POINTS.map((e) => resolve(CONFIG.root, e)),
  format: 'esm',
});

if (CONTENT_SCRIPT_ENTRY_POINTS.length) {
  await build({
    ...shared,
    entryPoints: CONTENT_SCRIPT_ENTRY_POINTS.map((e) => resolve(CONFIG.root, e)),
    format: 'iife',
  });
}

cpSync(resolve(CONFIG.root, 'public'), dist, { recursive: true });

if (!storeBuild) {
  const manifestPath = resolve(dist, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.optional_host_permissions) {
    manifest.host_permissions = manifest.optional_host_permissions;
    delete manifest.optional_host_permissions;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

console.log('built dist/');
