// Screenshot any extension page for a quick visual check.
// Usage:
//   node tools/shot.mjs                       # popup.html → tools/screenshots/popup.png
//   node tools/shot.mjs options.html          # → tools/screenshots/options.png
//   node tools/shot.mjs popup.html --out hero # → tools/screenshots/hero.png
//   node tools/shot.mjs popup.html --dark     # emulate prefers-color-scheme: dark
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { CONFIG } from './config.mjs';
import * as cdp from './cdp.mjs';

const SETTLE_MS = 600;
const POPUP_VIEW = { width: 380, height: 520 };
const DEVICE_SCALE = 2;

// Parse args: first non-flag token is the page path; --out names the file.
const args = process.argv.slice(2);
const page = args.find((a) => !a.startsWith('--')) ?? 'popup.html';
const outIdx = args.indexOf('--out');
const rawOut = outIdx !== -1 ? args[outIdx + 1] : basename(page).replace(/\.[^.]+$/, '');
const outName = rawOut.replace(/\.png$/i, '');
const dark = args.includes('--dark');

const ext = await cdp.findExtension();
if (!ext) {
  console.error('Extension not loaded — run `npm run browser` first.');
  process.exit(2);
}

const tab = await cdp.createTab(`chrome-extension://${ext.id}/${page}`);
const c = await cdp.CDP.connect(tab.webSocketDebuggerUrl);
try {
  await c.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }],
  });
  await c.send('Emulation.setDeviceMetricsOverride', {
    ...POPUP_VIEW,
    deviceScaleFactor: DEVICE_SCALE,
    mobile: false,
  });
  await cdp.sleep(SETTLE_MS);
  mkdirSync(resolve(CONFIG.root, 'tools/screenshots'), { recursive: true });
  const file = resolve(CONFIG.root, `tools/screenshots/${outName}.png`);
  const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(file);
} finally {
  c.close();
  await cdp.closeTab(tab.id);
}
