// test/stack.test.mjs · v0.8.1.12: stacked bars (2–4 series piled per point, totals above), from JSON
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, json } from './helpers.mjs';

function setup(widgets) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] });
  c.result = json(c.w.LBW.kit.setup({ prefix: 't', langs: ['es'], links: [], widgets }));
  c.check = (w) => json(c.w.LBW.kit.setup.check({ prefix: 't', langs: ['es'], links: [], widgets: w }));
  return c;
}
const draw = (c, tag) => { const m = c.bot('Text ' + tag); c.LBW.scan(); return m; };
const MIX = { type: 'chart', kind: 'bar', stack: true, title: 'Visitantes por mes', x: ['Jun', 'Jul', 'Ago'], y: { suffix: ' k' }, summary: 'Visitantes por mes y origen',
  series: [{ label: 'España', values: [10, 14, 16] }, { label: 'Europa', values: [6, 9, 12] }, { label: 'Resto', values: [2, 3, 0] }] };

test('stack: one bar per point, the series piled from 0 up, a total over each bar, the legend and the numbers for screen readers', () => {
  const c = setup({ mix: MIX }); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const m = draw(c, '[[t:mix]]'), r = [...m.querySelectorAll('rect.is-stack')];
  assert.equal(r.length, 8);                                              // 3 + 3 + 2: a 0 draws nothing
  assert.deepEqual([...m.querySelectorAll('.kit-stack-total')].map((t) => t.textContent), ['18 k', '26 k', '28 k']);
  const jun = r.filter((x) => Math.abs(+x.getAttribute('x') - +r[0].getAttribute('x')) < 0.01);
  assert.equal(jun.length, 3); assert.ok(+jun[1].getAttribute('y') + +jun[1].getAttribute('height') <= +jun[0].getAttribute('y') + 0.01);   // Europa sits on España
  assert.deepEqual([...m.querySelectorAll('.kit-legend-i')].map((x) => x.textContent), ['España', 'Europa', 'Resto']);
  assert.ok(m.querySelector('.kit-legend-i i.kit-s3'));
  assert.ok([...m.querySelectorAll('.kit-sr li')].some((li) => li.textContent === 'Ago: Total 28 k (España 16 k, Europa 12 k, Resto 0 k)'));
  c.close();
});

test('stack: past 6 points only the tallest total; every short x label; a formula that goes below 0 draws nothing', () => {
  const x = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const c = setup({ many: { ...MIX, x, series: [{ label: 'A', values: x.map(() => 1) }, { label: 'B', values: x.map(() => 2) }] },
    neg: { ...MIX, x: { from: 0, to: 3 }, series: [{ label: 'A', value: 'i - 2' }, { label: 'B', value: '1' }] } });
  const many = draw(c, '[[t:many]]');
  assert.equal(many.querySelectorAll('.kit-stack-total').length, 1);   // past 6 points: only the tallest (the first, when they tie)
  assert.deepEqual([...many.querySelectorAll('.kit-tick')].slice(-9).map((t) => t.textContent), x);   // short labels: every one
  assert.equal(draw(c, '[[t:neg]]').querySelector('.kit-chart'), null);
  c.close();
});

test('stack (critique 0.8.1.12): decimals in the language\'s own mark; the totals never reuse a class of another card', () => {
  const c = setup({ d: { ...MIX, series: [{ label: 'A', values: [1.25, 2, 3] }, { label: 'B', values: [6, 0.1, 10.3] }] } });
  const m = draw(c, '[[t:d]]');
  assert.deepEqual([...m.querySelectorAll('.kit-stack-total')].map((t) => t.textContent), ['7,25 k', '2,1 k', '13,3 k']);
  assert.equal(m.querySelectorAll('.kit-total').length, 0);
  c.close();
});

test('check: a stack is bars, 2 to 4 series, none below 0; without it three series is an error that names stack', () => {
  const c = setup({});
  const e = c.check({
    a: { ...MIX, kind: 'line' },
    b: { ...MIX, series: [MIX.series[0]] },
    d: { ...MIX, series: [{ label: 'A', values: [1, -2, 3] }, MIX.series[1]] },
    f: { ...MIX, stack: false },
    g: { ...MIX, stack: 'yes' } }).join('\n');
  for (const r of [/a: "stack" is for "kind": "bar"/, /b: a stacked chart holds 2 to 4 series/, /d: series\[0\]\.values: a stacked chart has no value below 0/, /f: "series" holds one or two series \(three or four: "stack": true/, /g: "stack" is true or false/])
    assert.match(e, r);
  assert.deepEqual(c.check({ mix: MIX }), []);
  c.close();
});
