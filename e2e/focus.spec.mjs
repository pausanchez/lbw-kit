// Focus moments (v0.14) as a visitor meets them: site/focus.html, the gallery's "Momentos de foco" conversation on a fake v4
// chat. The scripted agent draws the plan form as a moment, then the calendar; a free question mid-moment gets an answer that
// ends with the calendar's tag again; each moment that sends folds to its receipt; the booking ends with the pass.
// Every step is taken WITHOUT Playwright's scroll-into-view (an element's own click() in the page, or the text box), so
// "in view" is what the library put in view. At 390 × 844, 1440 × 900, and 390 × 464 (a phone with its keyboard open).
// The visitor-level checks (PRINCIPLES.md question 4): no duplicated live controls, the newest moment's heading in view after
// each reply, its primary action in view while it is taller than the chat, the receipt in its place once sent, Landbot's
// header and text box untouched and in view, the moment's text at 4.5:1 in light and dark, axe with no serious or critical.
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const NOW = new Date('2026-11-14T10:00:00+01:00');
const test = base.extend({
  pageErrors: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await use(errors);
    expect(errors, 'uncaught errors on the page').toEqual([]);
  },
  dark: [false, { option: true }],
  // the conversation, loaded, its first moment drawn (the agent answers after 150 ms)
  demo: async ({ page, pageErrors, dark }, use) => {
    await page.clock.install({ time: NOW });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript(() => { window.__focusDelay = 150; });
    await page.goto('/focus.html' + (dark ? '?dark=1' : ''));
    await expect(page.locator('.lbw.is-focus[data-widget="plan"]')).toHaveCount(1);
    await use(page);
  },
});

const SIZES = [['390 × 844', { width: 390, height: 844 }], ['1440 × 900', { width: 1440, height: 900 }], ['390 × 464, keyboard open', { width: 390, height: 464 }]];

// ── what the visitor sees, measured in the page ───────────────────────────────────────────────────
// the chat's scroller (the column between Landbot's header and its text box) and a box's place in it
const view = (page) => page.evaluate(() => {
  const col = document.querySelector('.col').getBoundingClientRect(), live = [...document.querySelectorAll('.lbw.is-focus:not(.is-focus-done)')].pop();
  const r = (x) => { if (!x) return null; const b = x.getBoundingClientRect(); return { top: b.top - col.top, bottom: b.bottom - col.top, height: b.height }; };
  return { col: { height: col.height }, live: live ? live.getAttribute('data-widget') : null, moment: r(live), heading: r(live && live.querySelector('.kit-focus-h')),
    dock: r(live && live.querySelector('.kit-dock, .kit-foot')) };
});
// the newest live moment's heading is inside the chat's visible column (nothing under the header, nothing under the text box)
async function headingInView(page, name) {
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('[role="status"]').length)).toBe(0);
  await expect(page.locator(`.lbw.is-focus:not(.is-focus-done)[data-widget="${name}"]`)).toHaveCount(1);
  await page.waitForTimeout(600);   // the reveal settles (lbw.js puts a tall reply's start in view, then holds it)
  const v = await view(page);
  expect(v.live).toBe(name);
  expect(v.heading.top, `${name}: its heading is not above the column`).toBeGreaterThanOrEqual(-1);
  expect(v.heading.bottom, `${name}: its heading is not under the text box`).toBeLessThanOrEqual(v.col.height + 1);
  return v;
}
// while the moment is taller than the chat, its primary action is in view (docked at the scroller's bottom)
async function dockInView(page) {
  const v = await view(page);
  if (!v.dock || v.moment.height <= v.col.height) return false;
  expect(v.dock.top, 'the docked action is in view').toBeGreaterThanOrEqual(-1);
  expect(v.dock.bottom, 'the docked action is in view').toBeLessThanOrEqual(v.col.height + 1);
  // and it stays there when the visitor scrolls back to the moment's start
  await page.evaluate(() => { const c = document.querySelector('.col'), m = [...document.querySelectorAll('.lbw.is-focus:not(.is-focus-done)')].pop(); c.scrollTop += m.getBoundingClientRect().top - c.getBoundingClientRect().top; });
  await page.waitForTimeout(50);
  const w = await view(page);
  expect(w.dock.bottom, 'docked at the moment\'s start too').toBeLessThanOrEqual(w.col.height + 1);
  expect(w.dock.top).toBeGreaterThanOrEqual(-1);
  return true;
}
// no control the visitor could use twice: per widget name, at most one copy with a visible, enabled button
const liveCopies = (page) => page.evaluate(() => {
  const by = {};
  for (const w of document.querySelectorAll('.lbw[data-widget]')) {
    if (w.closest('[inert]')) continue;
    const live = [...w.querySelectorAll('button')].some((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true' && !b.closest('.kit-sentline') && b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden');
    if (live) by[w.getAttribute('data-widget')] = (by[w.getAttribute('data-widget')] || 0) + 1;
  }
  return by;
});
async function noDuplicates(page) { const by = await liveCopies(page); for (const [n, k] of Object.entries(by)) expect(k, `live copies of ${n}`).toBe(1); }
// Landbot's header and text box: there, untouched by the library, and the text box inside the window
async function hostUntouched(page) {
  const r = await page.evaluate(() => {
    const h = document.querySelector('[data-lb-part="header"]'), i = document.querySelector('#say'), ib = i.getBoundingClientRect(), hb = h.getBoundingClientRect();
    const marks = [...document.querySelectorAll('*')].filter((x) => [...x.attributes].some((a) => a.name.startsWith('data-lbw') && a.name !== 'data-lbw-focus' && !x.closest('.lbw') && !x.closest('[data-lb-part="message"]')));
    return { header: hb.height > 0 && hb.top >= 0 && hb.bottom <= innerHeight, input: ib.height >= 40 && ib.top >= 0 && ib.bottom <= innerHeight && getComputedStyle(i).visibility === 'visible',
      focusMarks: [...document.querySelectorAll('[data-lbw-focus]')].every((x) => x.getAttribute('data-lb-part') === 'message'), marks: marks.map((x) => x.tagName + '.' + x.className) };
  });
  expect(r.header, 'Landbot\'s header is shown, in the window').toBe(true);
  expect(r.input, 'the text box is shown, inside the window').toBe(true);
  expect(r.focusMarks, 'the one mark on Landbot\'s tree is on a message').toBe(true);
  expect(r.marks, 'no other mark outside the messages').toEqual([]);
}
// the WCAG contrast of the moment's title, step line and actions against what is behind them
const contrasts = (page) => page.evaluate(() => {
  const rgb = (s) => { const m = s.match(/[\d.]+/g) || [0, 0, 0, 0]; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] == null ? 1 : +m[3] }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bg = (x) => { const st = []; for (let e = x; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.a > 0) st.push(c); if (c.a >= 1) break; }
    return st.reverse().reduce((acc, c) => over(c, acc), { r: 255, g: 255, b: 255, a: 1 }); };
  const out = [];
  for (const m of document.querySelectorAll('.lbw.is-focus')) {
    for (const x of m.querySelectorAll('.kit-focus-h, .kit-focus-step, .lbw-cta, .lbw-pill, .kit-stepn')) {
      if (!x.getClientRects().length || !x.textContent.trim()) continue;
      const fg = over(rgb(getComputedStyle(x).color), bg(x)), b = bg(x), a = lum(fg), c = lum(b);
      out.push({ what: m.getAttribute('data-widget') + ' ' + x.className.split(' ').slice(-1)[0] + ' "' + x.textContent.trim().slice(0, 24) + '"', ratio: Math.round(((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05)) * 100) / 100 });
    }
  }
  return out;
});
async function contrastOK(page) { const cs = await contrasts(page); expect(cs.length).toBeGreaterThan(0); for (const c of cs) expect(c.ratio, c.what).toBeGreaterThanOrEqual(4.5); }

// ── the visitor's steps, with no scroll-into-view: el.click() in the page, or typing in the text box ────
const clickIn = (page, sel) => page.evaluate((s) => { const x = document.querySelector(s); if (!x) throw new Error('no ' + s); x.click(); }, sel);
const LIVE = (name) => `.lbw.is-focus:not(.is-focus-done)[data-widget="${name}"]`;
async function fillPlan(page) {
  for (const k of ['suave', 'pareja', 'casco']) { await clickIn(page, `${LIVE('plan')} [data-k="${k}"]`); await page.waitForTimeout(60); }
  await clickIn(page, `${LIVE('plan')} .lbw-cta`);
}
async function type(page, text) {
  await page.evaluate(() => document.querySelector('#say').focus({ preventScroll: true }));
  await page.keyboard.type(text); await page.keyboard.press('Enter');
}
const DAY = (d) => `${LIVE('noches')} .kit-cal-d[aria-label^="${d}"]`;
// v0.14.0.1 · a pick the docked action would cover: the column is first scrolled so the day sits under the dock, then tapped
// (el.click()); the kit scrolls it up just enough. → true when the day really was covered before the tap
async function tapUncovered(page, sel) {
  const covered = await page.evaluate((s) => {
    const t = document.querySelector(s), m = t.closest('.lbw'), d = m.querySelector('.kit-dock, .kit-foot'), c = document.querySelector('.col');
    if (!d) return false;
    c.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));   // the visitor's own scroll: it ends lbw.js's hold on the newest reply
    c.scrollTop += t.getBoundingClientRect().bottom - d.getBoundingClientRect().top - 8;   // the day's bottom 8 px under the dock's top
    const a = t.getBoundingClientRect(), b = d.getBoundingClientRect();
    return a.bottom > b.top + 2 && a.top < b.bottom;
  }, sel);
  await clickIn(page, sel); await page.waitForTimeout(150);
  const r = await page.evaluate((s) => { const t = document.querySelector(s), d = t.closest('.lbw').querySelector('.kit-dock, .kit-foot'); return { a: t.getBoundingClientRect().bottom, b: d.getBoundingClientRect().top, top: t.getBoundingClientRect().top, col: document.querySelector('.col').getBoundingClientRect().top }; }, sel);
  expect(r.a, 'the picked day is not under the docked action').toBeLessThanOrEqual(r.b + 1);
  expect(r.top, 'nor scrolled off the top').toBeGreaterThanOrEqual(r.col - 1);
  return covered;
}
// the same sentence shown once: the visitor's bubble, not the receipt again
const shown = (page, text) => page.evaluate((t) => [...document.querySelectorAll('.msg *, .lbw *')].filter((x) => x.children.length === 0 && x.textContent.trim() === t && x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden').length, text);

for (const [label, viewport] of SIZES) {
  test.describe(`focus moments at ${label}`, () => {
    test.use({ viewport });

    test('the conversation: form → a question mid-moment → the calendar again → receipts → the pass', { tag: label === '390 × 844' ? '@smoke' : undefined }, async ({ demo: page }) => {
      // 1 · the plan form arrives as a moment: a labelled region, its heading in view (and focused: nobody is typing)
      await headingInView(page, 'plan');
      await expect(page.getByRole('region', { name: 'Tu escapada' })).toBeVisible();
      await expect(page.locator(`${LIVE('plan')} .kit-focus-step`)).toHaveText('Paso 1 de 3 · Tu plan');
      await expect(page.locator(`${LIVE('plan')} .kit-focus-h`)).toBeFocused();
      let docked = await dockInView(page); await noDuplicates(page); await hostUntouched(page);

      // 2 · sent: the form folds to its receipt line (one echo: the visitor's bubble says the sentence, the receipt doesn't
      // repeat it); the calendar arrives as the next moment, its past weeks left out
      await fillPlan(page);
      const plan = page.locator('.lbw[data-widget="plan"]'), said = 'Mi plan: Paseo tranquilo · en pareja · Extras: casco';
      await expect(plan).toHaveClass(/\bis-receipt\b/);
      await expect(plan.locator('.kit-sentline')).toHaveClass(/\bis-echoed\b/);
      await expect(plan.locator('.kit-sent-t')).toBeHidden();
      expect(await shown(page, said), 'the sentence shows once').toBe(1);
      await expect(plan.locator('.kit-focus-h')).toBeHidden();
      await headingInView(page, 'noches');
      await expect(page.locator(`${LIVE('noches')} .kit-focus-step`)).toHaveText('Paso 2 de 3 · Noches');
      await expect(page.locator(`${LIVE('noches')} .kit-cal-d[aria-label^="lunes, 2 de noviembre"]`)).toHaveCount(0);
      docked = (await dockInView(page)) || docked; await noDuplicates(page); await hostUntouched(page);

      // 3 · two nights picked, never under the docked action; then a free question: the answer ends with the moment again,
      // the new copy KEEPS the nights, the older copy is one line that says what it had
      let covered = await tapUncovered(page, DAY('lunes, 16 de noviembre'));
      covered = (await tapUncovered(page, DAY('jueves, 19 de noviembre'))) || covered;
      if (viewport.height < 600) expect(covered, 'a pick the dock covered was met').toBe(true);
      await expect(page.locator(`${LIVE('noches')} .kit-cal-sum`)).toContainText('3 noches');
      await type(page, '¿Admitís perros?');
      await expect(page.getByText('Sí, admitimos perros pequeños')).toBeVisible();
      await expect(page.locator('.lbw[data-widget="noches"]')).toHaveCount(2);
      await headingInView(page, 'noches');
      await expect(page.locator(`${DAY('lunes, 16 de noviembre')}[aria-pressed="true"]`), 'carried').toHaveCount(1);
      await expect(page.locator(`${DAY('jueves, 19 de noviembre')}[aria-pressed="true"]`)).toHaveCount(1);
      const old = page.locator('.lbw[data-widget="noches"]').first();
      await expect(old).toHaveClass(/\bis-inert\b/);
      await expect(old.locator('.kit-gone')).toBeVisible();
      await expect(old.locator('.kit-gone')).toContainText('Elige tus noches');
      await expect(old.locator('.kit-gone')).toContainText('3 noches');
      await expect(old.locator('.kit-cal-d').first()).toBeHidden();
      expect((await old.boundingBox()).height, 'one line').toBeLessThan(80);
      await expect(page.locator('#say'), 'focus stays in the text box').toBeFocused();
      docked = (await dockInView(page)) || docked; await noDuplicates(page); await hostUntouched(page);
      if (viewport.height < 600) expect(docked, 'a moment taller than the chat was met, its action docked').toBe(true);

      // 4 · dates in words: the tag carries them (from= to=), the calendar opens on December with them picked (the tag wins)
      await type(page, '¿Y en diciembre?');
      await expect(page.locator('.lbw[data-widget="noches"]')).toHaveCount(3);
      await headingInView(page, 'noches');
      await expect(page.locator(`${LIVE('noches')} .kit-cal-cap`).first()).toHaveText('Diciembre de 2026');
      await expect(page.locator(`${DAY('miércoles, 9 de diciembre')}[aria-pressed="true"]`)).toHaveCount(1);
      await expect(page.locator(`${LIVE('noches')} .kit-cal-sum`)).toContainText('3 noches');
      await expect(page.locator('.lbw.is-inert[data-widget="noches"]')).toHaveCount(2);
      await noDuplicates(page);

      // 5 · sent: the newest copy folds to its receipt; the pass arrives as the last step
      await clickIn(page, `${LIVE('noches')} .lbw-cta`);
      const nights = page.locator('.lbw[data-widget="noches"]').last();
      await expect(nights).toHaveClass(/\bis-receipt\b/);
      await expect(nights.locator('.kit-sentline')).toContainText('3 noches');
      await expect.poll(() => page.evaluate(() => (window.__lbwAnnounced || []).join(' | '))).toMatch(/Enviado: Quiero reservar la cabaña/);
      await headingInView(page, 'reserva');
      await expect(page.locator(`${LIVE('reserva')} .kit-focus-step`)).toHaveText('Paso 3 de 3 · Listo');
      await noDuplicates(page); await hostUntouched(page);
      expect(await page.evaluate(() => window.__focusSent.map((s) => s.text))).toEqual([said, expect.stringMatching(/^Quiero reservar la cabaña del 9\/12\/2026 al 12\/12\/2026: 3 noches/)]);
    });

    test('a question typed mid-moment doesn\'t end it: its controls still work, and the text box keeps focus', async ({ demo: page }) => {
      await headingInView(page, 'plan');
      // the agent answers WITHOUT the tag this time (a reply that forgot it): the moment stays live, not stale
      await page.evaluate(() => { window.__focusRetag = false; });
      await type(page, 'hola');
      await expect(page.getByText('Te leo.')).toBeVisible();
      await expect(page.locator('#say')).toBeFocused();
      await expect(page.locator('.lbw[data-widget="plan"]').last()).not.toHaveClass(/\bis-inert\b/);
      await fillPlan(page);
      await expect(page.locator('.lbw[data-widget="plan"]').last()).toHaveClass(/\bis-receipt\b/);
      await noDuplicates(page);
    });
  });
}

// the moment's text against what is behind it, light and dark, at a phone's width
for (const dark of [false, true]) {
  test.describe(`focus moments, ${dark ? 'dark' : 'light'} tokens`, () => {
    test.use({ viewport: { width: 390, height: 844 }, dark });
    test('the title, the step line and the actions read at 4.5:1 or more', async ({ demo: page }) => {
      await headingInView(page, 'plan');
      await contrastOK(page);
      await fillPlan(page);
      await headingInView(page, 'noches');
      await contrastOK(page);
    });
  });
}

// axe on the conversation once both moments are drawn (a receipt, an inert copy and a live moment on the page)
for (const [label, viewport] of SIZES.slice(0, 2)) {
  test.describe(`focus moments, axe at ${label}`, () => {
    test.use({ viewport });
    test('axe: 0 serious or critical violations', async ({ demo: page }) => {
      await fillPlan(page);
      await headingInView(page, 'noches');
      await type(page, '¿Admitís perros?');
      await expect(page.locator('.lbw[data-widget="noches"]')).toHaveCount(2);
      await headingInView(page, 'noches');
      await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().endTime !== Infinity).map((a) => a.finished.catch(() => {}))));
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !(v.id === 'label-content-name-mismatch' && /class="kit-cal-d\b/.test(n.html))) })).filter((v) => v.nodes.length)
        .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(bad).toEqual([]);
    });
  });
}

// v0.14.0.1 · no text the library draws is under 14 px (labels, captions, a calendar day's price), in the conversation's moments
test.describe('focus moments, text size', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('every visible text in a widget is 14 px or more', async ({ demo: page }) => {
    await fillPlan(page); await headingInView(page, 'noches');
    const small = await page.evaluate(() => {
      const out = [];
      for (const w of document.querySelectorAll('.lbw')) {
        const tw = document.createTreeWalker(w, NodeFilter.SHOW_TEXT); let n;
        while ((n = tw.nextNode())) {
          const e = n.parentElement; if (!n.nodeValue.trim() || !e.getClientRects().length) continue;
          const r = e.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) continue;   // screen-reader only
          const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 14) out.push(`${e.className} "${n.nodeValue.trim().slice(0, 20)}" ${fs}px`);
        }
      }
      return out;
    });
    expect(small).toEqual([]);
  });
});
