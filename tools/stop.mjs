// Cleanly shut down the dev browser instance (never touches the main browser —
// only whatever is listening on the dev CDP port).
import { browser, isUp, sleep } from './cdp.mjs';

const CLOSE_TIMEOUT_MS = 2000;
const SETTLE_MS = 300;

if (!(await isUp())) {
  console.log('Dev browser not running.');
  process.exit(0);
}

const b = await browser();
await Promise.race([b.send('Browser.close'), sleep(CLOSE_TIMEOUT_MS)]);
b.close();
// Give the WebSocket handle a beat to tear down, then exit naturally —
// process.exit() mid-close trips a libuv assertion on Windows.
await sleep(SETTLE_MS);
console.log('Dev browser closed.');
