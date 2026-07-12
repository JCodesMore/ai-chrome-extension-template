// Central config for the dev-loop tooling. Every path is derived from the repo
// root, and nothing here is product-specific — the extension name is read
// dynamically from public/manifest.json so renaming the extension needs no
// tooling edits. Override the browser binary with BROWSER_EXE and the CDP port
// with CDP_PORT; both are the only knobs a fork should ever need.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The unpacked extension's display name comes from the manifest — it is the
// fallback key findExtension() uses when path-matching can't identify our build.
function readExtensionName() {
  try {
    const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.json'), 'utf8'));
    return manifest.name;
  } catch {
    return 'Unnamed Extension';
  }
}

export const CONFIG = {
  root,
  port: Number(process.env.CDP_PORT || 9222),
  profileDir: resolve(root, '.dev-profile'),
  extensionDir: resolve(root, 'dist'),
  // Chrome for Testing lives here so it's cached per-repo and gitignored.
  browserCacheDir: resolve(root, '.browser'),
  // Set BROWSER_EXE to point at any Chromium build that supports --load-extension
  // (branded Chrome/Edge dropped it in v137+; leave null to auto-fetch CfT).
  browserExe: process.env.BROWSER_EXE || null,
  extensionName: readExtensionName(),
};
