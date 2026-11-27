/* eslint-disable no-console */
// Show tk / ch / ru side by side for keys matching a regex, so you can see how
// ch.json actually renders a word before writing a new Chärjew string.
//
//   node .claude/skills/charjew-translation/compare.mjs "<regex>" [--dialect] [--limit N]
//
// The regex is case-insensitive and Unicode-aware, matched against the key and
// the tk, ch and ru values. Entries whose ch value equals tk are tagged [= tk]:
// they were machine-translated standard Turkmen (add-translation-row.mjs maps
// ch -> tk), so they are NOT dialect precedent. --dialect hides them.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const i18nDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../src/i18n',
);
const load = (locale) =>
  JSON.parse(readFileSync(join(i18nDir, `${locale}.json`), 'utf8'));

const args = process.argv.slice(2);
const pattern = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
if (!pattern) {
  console.error('Usage: node compare.mjs "<regex>" [--dialect] [--limit N]');
  process.exit(1);
}
const dialectOnly = args.includes('--dialect');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 40;

const tk = load('tk');
const ch = load('ch');
const ru = load('ru');
const re = new RegExp(pattern, 'iu');

const hits = Object.keys(ch).filter((key) => {
  if (dialectOnly && ch[key] === tk[key]) return false;
  return [key, tk[key], ch[key], ru[key]].some(
    (v) => typeof v === 'string' && re.test(v),
  );
});

hits.slice(0, limit).forEach((key) => {
  const machine = ch[key] === tk[key] ? '  [= tk]' : '';
  console.log(
    `## ${key}${machine}\n  tk: ${tk[key]}\n  ch: ${ch[key]}\n  ru: ${ru[key]}`,
  );
});
console.log(
  `\n${hits.length} match(es)${hits.length > limit ? `, showing ${limit}` : ''}.`,
);
