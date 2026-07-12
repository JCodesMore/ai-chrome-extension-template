// Zero-dependency Chrome DevTools Protocol helpers (Node 22+: global fetch & WebSocket).
// Talks to the DEV browser instance on CONFIG.port — never the user's main browser.
import { writeFileSync } from 'node:fs';
import { CONFIG } from './config.mjs';

const BASE = `http://127.0.0.1:${CONFIG.port}`;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function browserVersion() {
  const res = await fetch(`${BASE}/json/version`);
  return res.json();
}

export async function isUp() {
  try {
    await browserVersion();
    return true;
  } catch {
    return false;
  }
}

export async function listTargets() {
  const res = await fetch(`${BASE}/json/list`);
  return res.json();
}

export class CDP {
  #ws;
  #id = 0;
  #pending = new Map();

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error(`WebSocket connect failed: ${url}`)), {
        once: true,
      });
    });
    return new CDP(ws);
  }

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.#pending.has(msg.id)) {
        const { resolve, reject } = this.#pending.get(msg.id);
        this.#pending.delete(msg.id);
        if (msg.error)
          reject(new Error(`${msg.error.message}${msg.error.data ? `: ${msg.error.data}` : ''}`));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.#id;
    const promise = new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject }));
    this.#ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close() {
    this.#ws.close();
  }
}

export async function browser() {
  const { webSocketDebuggerUrl } = await browserVersion();
  return CDP.connect(webSocketDebuggerUrl);
}

export async function evalOnTarget(target, expression) {
  const c = await CDP.connect(target.webSocketDebuggerUrl);
  try {
    const res = await c.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(
        `Evaluate failed on ${target.url}: ${res.exceptionDetails.exception?.description ?? JSON.stringify(res.exceptionDetails)}`,
      );
    }
    return res.result.value;
  } finally {
    c.close();
  }
}

// chrome://extensions has the chrome.developerPrivate API — our management surface.
export async function extensionsPage() {
  const find = async () =>
    (await listTargets()).find((t) => t.type === 'page' && t.url.startsWith('chrome://extensions'));
  let page = await find();
  if (!page) {
    const b = await browser();
    try {
      await b.send('Target.createTarget', { url: 'chrome://extensions/' });
    } finally {
      b.close();
    }
    for (let i = 0; i < 20 && !page; i++) {
      await sleep(150);
      page = await find();
    }
  }
  if (!page) throw new Error('Could not open chrome://extensions management page');
  return page;
}

export async function enableDevMode() {
  const page = await extensionsPage();
  return evalOnTarget(
    page,
    `new Promise((r) =>
    chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true },
      () => r(chrome.runtime.lastError?.message ?? null)))`,
  );
}

export async function extensionsInfo() {
  const page = await extensionsPage();
  return evalOnTarget(page, `new Promise((r) => chrome.developerPrivate.getExtensionsInfo(r))`);
}

// Match by unpacked path, not name — the path is what identifies our build
// (renames would otherwise strand the dev loop). Name kept as a fallback for
// robustness if developerPrivate ever omits the path.
export async function findExtension(name = CONFIG.extensionName) {
  const wanted = CONFIG.extensionDir.replaceAll('\\', '/').toLowerCase();
  const all = (await extensionsInfo()) ?? [];
  return (
    all.find((e) => (e.path ?? '').replaceAll('\\', '/').toLowerCase() === wanted) ??
    all.find((e) => e.name === name)
  );
}

// Chrome accumulates extension errors across loads; clear them so each
// reload's error report reflects only the current code.
export async function clearExtensionErrors(id) {
  const page = await extensionsPage();
  return evalOnTarget(
    page,
    `new Promise((r) =>
    chrome.developerPrivate.deleteExtensionErrors({ extensionId: ${JSON.stringify(id)} },
      () => r(chrome.runtime.lastError?.message ?? null)))`,
  );
}

// Resolves to null on success, or a LoadError-ish object on failure.
export async function reloadExtension(id) {
  const page = await extensionsPage();
  return evalOnTarget(
    page,
    `new Promise((r) =>
    chrome.developerPrivate.reload(${JSON.stringify(id)},
      { failQuietly: true, populateErrorForUnpacked: true },
      (err) => r(err ?? (chrome.runtime.lastError ? { message: chrome.runtime.lastError.message } : null))))`,
  );
}

// Initial load fallback; needs --enable-unsafe-extension-debugging on the browser.
export async function loadUnpacked(path) {
  const b = await browser();
  try {
    return await b.send('Extensions.loadUnpacked', { path });
  } finally {
    b.close();
  }
}

export async function createTab(url) {
  const b = await browser();
  let targetId;
  try {
    ({ targetId } = await b.send('Target.createTarget', { url }));
  } finally {
    b.close();
  }
  for (let i = 0; i < 20; i++) {
    const t = (await listTargets()).find((t) => t.id === targetId);
    if (t?.webSocketDebuggerUrl) {
      // Wait until the document (and, on extension pages, the chrome.* APIs)
      // is actually ready — evaluating too early hits a half-initialized context.
      for (let j = 0; j < 30; j++) {
        try {
          if (await evalOnTarget(t, `document.readyState === 'complete'`)) return t;
        } catch {
          /* target still swapping contexts */
        }
        await sleep(100);
      }
      return t;
    }
    await sleep(150);
  }
  throw new Error(`Opened ${url} but target ${targetId} never appeared in /json/list`);
}

export async function closeTab(targetId) {
  const b = await browser();
  try {
    await b.send('Target.closeTarget', { targetId });
  } finally {
    b.close();
  }
}

export async function screenshot(target, file) {
  const b = await browser();
  try {
    await b.send('Target.activateTarget', { targetId: target.id });
  } finally {
    b.close();
  }
  const c = await CDP.connect(target.webSocketDebuggerUrl);
  try {
    await c.send('Page.enable');
    const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(data, 'base64'));
    return file;
  } finally {
    c.close();
  }
}
