// Send an arbitrary runtime message to the extension's service worker and print
// its response. The message is dispatched from the popup page context, so
// chrome.runtime.sendMessage reaches the SW exactly as the UI would.
// Usage:
//   node tools/send.mjs ping                     # bare-word convenience
//   node tools/send.mjs '{"type":"ping"}'        # any JSON message
//   node tools/send.mjs '{"type":"greet","name":"Ada"}'
import * as cdp from './cdp.mjs';

const raw = process.argv[2];
if (!raw) {
  console.error(`usage: node tools/send.mjs '<json>'   (or the bare word: ping)`);
  process.exit(2);
}

let message;
if (raw === 'ping') {
  message = { type: 'ping' };
} else {
  try {
    message = JSON.parse(raw);
  } catch (e) {
    console.error(`Not valid JSON: ${e.message}`);
    process.exit(2);
  }
}

const ext = await cdp.findExtension();
if (!ext) {
  console.error('Extension not loaded — run `npm run browser` first.');
  process.exit(2);
}

const tab = await cdp.createTab(`chrome-extension://${ext.id}/popup.html`);
try {
  const res = await cdp.evalOnTarget(tab, `chrome.runtime.sendMessage(${JSON.stringify(message)})`);
  console.log(JSON.stringify(res, null, 2));
} finally {
  await cdp.closeTab(tab.id);
}
