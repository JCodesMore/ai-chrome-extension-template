// Renders docs/assets/preview.html to docs/assets/preview.png (1280x640 @2x)
// using the dev browser. Usage: npm run browser && node scripts/gen-preview.mjs
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as cdp from '../tools/cdp.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1280;
const HEIGHT = 640;
const SCALE = 2;
const SETTLE_MS = 600;

if (!(await cdp.isUp())) {
  console.error('Dev browser not running — run `npm run browser` first.');
  process.exit(2);
}

const url = pathToFileURL(resolve(root, 'docs/assets/preview.html')).href;
const tab = await cdp.createTab(url);
const c = await cdp.CDP.connect(tab.webSocketDebuggerUrl);
try {
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: SCALE,
    mobile: false,
  });
  await cdp.sleep(SETTLE_MS);
  const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
  const out = resolve(root, 'docs/assets/preview.png');
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(out);
} finally {
  c.close();
  await cdp.closeTab(tab.id);
}
