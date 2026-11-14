// scripts/check-config.mjs · check a bot's widget config without a browser or a bot.
//   node scripts/check-config.mjs path/to/config.json          exit 0 when valid; prints one line per problem otherwise
//   node scripts/check-config.mjs --json path/to/config.json   the same as JSON, for an agent: [{ widget, path, message, fix }]
import fs from 'node:fs';
import { checkConfig, checkConfigDetailed } from './lib.mjs';

const args = process.argv.slice(2), json = args.includes('--json'), file = args.find((a) => a !== '--json');
if (!file) { console.error('usage: node scripts/check-config.mjs [--json] <config.json>'); process.exit(2); }
let config;
try { config = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
  if (json) console.log(JSON.stringify([{ widget: null, path: null, message: `${file}: not valid JSON (${e.message})`, fix: null }], null, 2));
  else console.error(`${file}: not valid JSON (${e.message})`);
  process.exit(1);
}
if (json) { const errors = checkConfigDetailed(config); console.log(JSON.stringify(errors, null, 2)); process.exit(errors.length ? 1 : 0); }
const errors = checkConfig(config);
if (errors.length) { errors.forEach((e) => console.error('✖ ' + e)); process.exit(1); }
console.log(`✔ ${file}: ${Object.keys(config.widgets).length} widgets, prefix "${config.prefix}"`);
