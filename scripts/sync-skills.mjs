// Regenerates platform-specific copies of the canonical /chrome-extension skill.
// Source of truth: .claude/skills/chrome-extension/SKILL.md
// Copies:          .agents/skills/chrome-extension/SKILL.md  (Agent Skills standard — Codex et al.)
//                  .codex/skills/chrome-extension/SKILL.md   (older Codex discovery path)
// Run after editing the canonical file: npm run sync
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, '.claude/skills/chrome-extension/SKILL.md');
const TARGETS = [
  join(root, '.agents/skills/chrome-extension/SKILL.md'),
  join(root, '.codex/skills/chrome-extension/SKILL.md'),
];

const src = readFileSync(SOURCE, 'utf8');

// Insert the do-not-edit banner AFTER the YAML frontmatter block (frontmatter must stay first).
const FM_END = src.indexOf('\n---', src.indexOf('---'));
if (FM_END === -1) throw new Error(`No frontmatter found in ${SOURCE}`);
const insertAt = src.indexOf('\n', FM_END + 1) + 1;
const banner =
  '\n<!-- AUTO-GENERATED from .claude/skills/chrome-extension/SKILL.md — do not edit directly. Run `npm run sync` to regenerate. -->\n';
const out = src.slice(0, insertAt) + banner + src.slice(insertAt);

for (const target of TARGETS) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, out);
  console.log(`synced ${target}`);
}
