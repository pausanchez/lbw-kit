// A realistic use of the types: the runtime-in-20-lines example (AGENTS.md) in TypeScript. Must type-check.
import type { LbwConfig } from '../../../types/lbw-kit';

const IDS = ['boots', 'cap'] as const;
const DATA: Record<string, { name: string; price: string; url: string }> = {
  boots: { name: 'Boots', price: '$80', url: 'boots' },
  cap: { name: 'Cap', price: '$20', url: 'cap' },
};

LBW.init({ prefix: 'np', langs: ['en', 'es'], defaultLang: 'en', links: ['https://shop.example/'], labels: { en: { price: 'Price' }, es: { price: 'Precio' } } });

LBW.widget('card', (p, ctx) => {
  const id = p.one('id', IDS);
  if (!id) return null;
  const o = LBW.ui.card(ctx.lang, 'np-card');
  LBW.ui.head(o.box, 'Kicker', DATA[id].name);
  LBW.ui.rows(o.box, [[ctx.L.price, DATA[id].price]]);
  LBW.ui.row(o, [
    LBW.ui.reply('Details', 'More about ' + DATA[id].name, { primary: true }),
    LBW.ui.link('Buy ↗', 'https://shop.example/' + DATA[id].url),
  ]);
  return o;
});

LBW.widget('size', (_p, ctx) => {
  const g = LBW.ui.once('lbw-chips');
  (['s', 'm', 'l'] as const).forEach((s) => {
    g.appendChild(LBW.ui.reply(s.toUpperCase(), 'Size ' + s.toUpperCase(), { fields: { size: s } }));
  });
  const o = LBW.ui.card(ctx.lang);
  o.box.appendChild(g);
  return o;
});

LBW.widget('summary', (p, ctx) => {
  const o = LBW.ui.card(ctx.lang);
  const n = p.num('guests', 1, 12, 2, { int: true });
  const day = p.day('day');
  LBW.ui.head(o.box, day == null ? '' : LBW.day.str(day), p.text('name', 40) || 'Guest ' + n);
  return o;
});

const SHEET = 'https://docs.google.com/spreadsheets/d/e/x/pub?output=csv';
LBW.csv(SHEET);
LBW.widget('place', (p, ctx) => {
  const o = LBW.ui.loading(ctx.lang, 'lbw-split', 'card');
  return LBW.later(o, LBW.csv(SHEET), (rows) => {
    const r = rows.filter((x) => x.id === p.raw.id)[0];
    if (!r) return false;
    LBW.ui.head(o.box, 'Our places', r.city.slice(0, 40));
  }, () => {
    LBW.ui.row(o.box, [LBW.ui.link('See all ↗', 'https://shop.example/places')]);
  });
});

const config: LbwConfig = { prefix: 'np', langs: ['en'], widgets: {} };
const errors: string[] = LBW.kit.setup.check(config);
if (!errors.length) {
  const res = LBW.kit.setup(config);
  if (!res.ok) console.log(window.__kitSetupErrors, res.widgets);
}
console.log(window.__lbwDropped, LBW.version, LBW.kit.h.money(24700, { cur: '€' }));
