// Launch (or attach to) the dedicated dev browser instance and ensure the
// unpacked extension is loaded. Idempotent — safe to run any time.
//
// Browser strategy: branded Chrome/Edge removed --load-extension in v137+ (2025),
// so we drive Chrome for Testing (CfT), which still supports side-loading and is
// Google's recommended vehicle for automation. On first run we fetch CfT into
// .browser/ via @puppeteer/browsers; set BROWSER_EXE to reuse an existing
// Chromium build (must still support --load-extension) and skip the download.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Browser,
  detectBrowserPlatform,
  resolveBuildId,
  computeExecutablePath,
  install,
} from '@puppeteer/browsers';
import { CONFIG } from './config.mjs';
import { isUp, sleep, browserVersion, enableDevMode, findExtension, loadUnpacked } from './cdp.mjs';

const LAUNCH_TIMEOUT_MS = 30_000;
const POLL_MS = 500;
const BUILD_ID_CACHE = resolve(CONFIG.browserCacheDir, 'last-good-build-id');
const PROGRESS_STEP = 10; // print a line every 10% of the download

// Resolve a runnable browser executable. Prefers BROWSER_EXE, else a cached CfT
// build, fetching it once if absent. Returns { exe, label } for the summary.
async function resolveBrowserExe() {
  if (CONFIG.browserExe) {
    if (!existsSync(CONFIG.browserExe))
      throw new Error(`BROWSER_EXE points at a missing file: ${CONFIG.browserExe}`);
    return { exe: CONFIG.browserExe, label: 'custom (BROWSER_EXE)' };
  }

  const platform = detectBrowserPlatform();
  if (!platform) throw new Error('Could not detect the OS platform for Chrome for Testing.');

  mkdirSync(CONFIG.browserCacheDir, { recursive: true });

  // resolveBuildId hits the network; cache the answer so offline reruns still work.
  let buildId;
  try {
    buildId = await resolveBuildId(Browser.CHROME, platform, 'stable');
    writeFileSync(BUILD_ID_CACHE, buildId);
  } catch (e) {
    if (!existsSync(BUILD_ID_CACHE))
      throw new Error(`Cannot resolve a Chrome for Testing build and no cache exists`, {
        cause: e,
      });
    buildId = readFileSync(BUILD_ID_CACHE, 'utf8').trim();
    console.log(`Offline — using cached Chrome for Testing build ${buildId}.`);
  }

  const opts = { cacheDir: CONFIG.browserCacheDir, browser: Browser.CHROME, buildId };
  let exe = computeExecutablePath(opts);
  if (!existsSync(exe)) {
    console.log('Downloading Chrome for Testing (~200-300 MB, one-time)…');
    let lastPct = -PROGRESS_STEP;
    await install({
      ...opts,
      downloadProgressCallback: (downloaded, total) => {
        const pct = Math.floor((downloaded / total) * 100);
        if (pct >= lastPct + PROGRESS_STEP) {
          lastPct = pct;
          console.log(`  …${pct}%`);
        }
      },
    });
    exe = computeExecutablePath(opts);
  }
  return { exe, label: `Chrome for Testing ${buildId}` };
}

async function ensureExtension() {
  await enableDevMode();
  let ext = await findExtension();
  if (!ext) {
    console.log('Extension not loaded via --load-extension; trying CDP Extensions.loadUnpacked…');
    try {
      await loadUnpacked(CONFIG.extensionDir);
    } catch (e) {
      console.error(`Extensions.loadUnpacked failed: ${e.message}`);
    }
    ext = await findExtension();
  }
  if (!ext) {
    throw new Error(
      'Could not load the unpacked extension by any method. Branded Chrome/Edge cannot ' +
        'side-load extensions (v137+) — set BROWSER_EXE to a Chromium/Chrome-for-Testing ' +
        'build that supports --load-extension, or let this script fetch CfT automatically.',
    );
  }
  return ext;
}

let status = 'already-running';
let browserLabel = 'attached';

if (!(await isUp())) {
  status = 'launched';

  // Build dist/ if it's missing — the browser needs something to --load-extension.
  if (!existsSync(resolve(CONFIG.extensionDir, 'manifest.json'))) {
    console.log('dist/ missing — building it first…');
    const build = spawnSync(process.execPath, [resolve(CONFIG.root, 'tools/build.mjs')], {
      stdio: 'inherit',
    });
    if (build.status !== 0) throw new Error('Build failed — cannot launch without dist/.');
  }

  const { exe, label } = await resolveBrowserExe();
  browserLabel = label;

  mkdirSync(CONFIG.profileDir, { recursive: true });
  const args = [
    `--user-data-dir=${CONFIG.profileDir}`,
    `--remote-debugging-port=${CONFIG.port}`,
    '--enable-unsafe-extension-debugging',
    `--load-extension=${CONFIG.extensionDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];
  spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();

  let up = false;
  for (let waited = 0; waited < LAUNCH_TIMEOUT_MS && !up; waited += POLL_MS) {
    await sleep(POLL_MS);
    up = await isUp();
  }
  if (!up) throw new Error(`Browser did not open CDP port ${CONFIG.port} within 30s`);
}

const ext = await ensureExtension();
console.log(
  JSON.stringify(
    {
      status,
      browser: `${(await browserVersion()).Browser} (${browserLabel})`,
      cdp: `http://127.0.0.1:${CONFIG.port}`,
      extension: { id: ext.id, name: ext.name, version: ext.version, state: ext.state },
    },
    null,
    2,
  ),
);
