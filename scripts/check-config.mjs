// scripts/check-config.mjs · check a bot's widget config without a browser or a bot.
//   node scripts/check-config.mjs path/to/config.json     exit 0 when valid; prints one line per problem otherwise
import fs from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/check-config.mjs <config.json>'); process.exit(2); }
let config;
try { config = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error(`${file}: not valid JSON (${e.message})`); process.exit(1); }

// setup.js only needs LBW.kit to exist to define check(): nothing is drawn here
const window = { LBW: { ui: {}, day: {}, kit: { h: {} } } };
vm.runInNewContext(fs.readFileSync(new URL('../kit/setup.js', import.meta.url), 'utf8'), { window });
const errors = window.LBW.kit.setup.check(config);
if (errors.length) { errors.forEach((e) => console.error('✖ ' + e)); process.exit(1); }
console.log(`✔ ${file}: ${Object.keys(config.widgets).length} widgets, prefix "${config.prefix}"`);
