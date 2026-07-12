// Renders the README image assets from their HTML sources in docs/assets/
// using the dev browser. Usage: npm run browser && node scripts/gen-preview.mjs
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as cdp from '../tools/cdp.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCALE = 2;
const SETTLE_MS = 600;

// Each asset: HTML source, output PNG, and the fixed canvas size of its <body>.
const ASSETS = [
  { html: 'docs/assets/preview.html', out: 'docs/assets/preview.png', width: 1280, height: 640 },
  {
    html: 'docs/assets/guide-use-template.html',
    out: 'docs/assets/guide-use-template.png',
    width: 900,
    height: 240,
  },
  {
    html: 'docs/assets/guide-create-repo.html',
    out: 'docs/assets/guide-create-repo.png',
    width: 900,
    height: 430,
  },
];

if (!(await cdp.isUp())) {
  console.error('Dev browser not running — run `npm run browser` first.');
  process.exit(2);
}

for (const asset of ASSETS) {
  const tab = await cdp.createTab(pathToFileURL(resolve(root, asset.html)).href);
  const c = await cdp.CDP.connect(tab.webSocketDebuggerUrl);
  try {
    await c.send('Emulation.setDeviceMetricsOverride', {
      width: asset.width,
      height: asset.height,
      deviceScaleFactor: SCALE,
      mobile: false,
    });
    // Wait for webfonts before capturing, then settle.
    await c.send('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(() => true)',
      awaitPromise: true,
    });
    await cdp.sleep(SETTLE_MS);
    const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
    const out = resolve(root, asset.out);
    writeFileSync(out, Buffer.from(data, 'base64'));
    console.log(out);
  } finally {
    c.close();
    await cdp.closeTab(tab.id);
  }
}
