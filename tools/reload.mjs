// Reload the unpacked extension after a code change. Exits non-zero and prints
// the load error if the new code fails to load (manifest/syntax errors).
import { findExtension, reloadExtension, clearExtensionErrors, sleep } from './cdp.mjs';

const SETTLE_MS = 300;

const ext = await findExtension();
if (!ext) {
  console.error('Extension not found in dev browser — run `npm run browser` first.');
  process.exit(2);
}

await clearExtensionErrors(ext.id);
const loadError = await reloadExtension(ext.id);
if (loadError) {
  console.error(`RELOAD FAILED:\n${JSON.stringify(loadError, null, 2)}`);
  process.exit(1);
}

await sleep(SETTLE_MS);
const after = await findExtension();
const errors = [...(after?.manifestErrors ?? []), ...(after?.runtimeErrors ?? [])].map((e) => ({
  message: e.message,
  source: e.source,
  line: e.line,
}));

console.log(
  JSON.stringify(
    {
      status: 'reloaded',
      id: after?.id,
      version: after?.version,
      state: after?.state,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length || after?.state !== 'ENABLED') process.exit(1);
