// End-to-end smoke test: extension loaded → service worker responds → popup
// renders → screenshot for a visual check.
//
// Extend this file with feature-specific checks as you build — every feature
// should add at least one smoke assertion. The check()/exit-code skeleton is the
// contract the dev loop relies on: `npm run smoke` must exit non-zero the moment
// anything the extension promises stops working.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from './config.mjs';
import * as cdp from './cdp.mjs';

const SETTLE_MS = 400;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  const extra =
    detail === undefined
      ? ''
      : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra}`);
}

if (!(await cdp.isUp())) {
  console.error('Dev browser not running — run `npm run browser` first.');
  process.exit(2);
}

const ext = await cdp.findExtension();
check(
  'extension loaded & enabled',
  ext?.state === 'ENABLED',
  ext ? `v${ext.version} (${ext.id})` : 'not found',
);
if (!ext) process.exit(1);

const tab = await cdp.createTab(`chrome-extension://${ext.id}/popup.html`);
await cdp.sleep(SETTLE_MS);

// The service worker answers { type: 'ping' } with { pong: true } — this is the
// contract src/background.ts implements; keep the two in sync.
const pong = await cdp.evalOnTarget(tab, `chrome.runtime.sendMessage({ type: 'ping' })`);
check('service worker responds to ping', pong?.pong === true, pong);

// Popup rendered *something* — proves popup.js ran without throwing.
const rendered = await cdp.evalOnTarget(
  tab,
  `(() => {
  const app = document.querySelector('#app');
  return {
    hasApp: !!app,
    appFilled: (app?.textContent ?? '').trim().length > 0,
    bodyChildren: document.body.children.length,
  };
})()`,
);
check(
  'popup DOM rendered',
  rendered?.hasApp === true && rendered.appFilled === true && rendered.bodyChildren > 0,
  rendered,
);

mkdirSync(resolve(CONFIG.root, 'tools/screenshots'), { recursive: true });
const file = resolve(CONFIG.root, 'tools/screenshots/smoke-popup.png');
await cdp.screenshot(tab, file);
check('screenshot captured', true, file);

await cdp.closeTab(tab.id);

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failed.length ? 1 : 0);
