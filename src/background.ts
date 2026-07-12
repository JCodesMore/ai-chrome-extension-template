// MV3 background service worker — the extension's event hub.
//
// Message contract: every request shape lives in src/lib/messages.ts. To add a
// behaviour, add a variant to the Msg union there, then add a matching case to
// handle() below — the typed switch keeps the two in lockstep and TypeScript
// flags any request type you forget to handle.
//
// The { type: 'ping' } → { pong: true, version } reply is load-bearing:
// tools/smoke.mjs asserts it to prove the SW is alive. Keep it working.
import { isMsg, type Msg, type MsgResponse } from './lib/messages';

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[background] installed (${details.reason})`);
});

// Pure request→response dispatch. Add a case per new Msg variant.
function handle(message: Msg): MsgResponse[Msg['type']] {
  switch (message.type) {
    case 'ping':
      return { pong: true, version: chrome.runtime.getManifest().version };
    default:
      // Exhaustiveness guard: if a new Msg variant is unhandled, this line
      // fails to type-check, pointing you straight at the missing case.
      return assertNever(message.type);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled message type: ${String(value)}`);
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isMsg(message)) return false; // not ours — let other listeners try
  sendResponse(handle(message));
  return true; // response delivered synchronously; keep the channel tidy
});
