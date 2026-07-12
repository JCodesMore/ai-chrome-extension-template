// Popup entry point. Renders the extension's name/version from the manifest and
// pings the service worker to show it's alive. Framework-free DOM code — swap in
// whatever UI you like, but keep #app populated (tools/smoke.mjs checks for it).
import { sendMessage } from '../lib/messages';

const manifest = chrome.runtime.getManifest();

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

setText('name', manifest.name);
setText('version', `v${manifest.version}`);

// Ask the SW to confirm it's running, then reflect the result in the status line.
sendMessage({ type: 'ping' })
  .then((res) => {
    setText(
      'status',
      res.pong ? `Service worker: OK (v${res.version})` : 'Service worker: no reply',
    );
  })
  .catch((err: unknown) => {
    setText('status', `Service worker error: ${err instanceof Error ? err.message : String(err)}`);
  });
