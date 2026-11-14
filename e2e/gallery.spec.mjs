// The gallery (site/index.html) drawn by the real built library: render, layout, accessibility and interactions.
// The page's clock is pinned (14 Nov 2026, Madrid) so the calendar, slots and "today" read the same on every run;
// time still flows, so the runtime's quiet wait before a send works as in a real chat.
// Smoke: tests tagged @smoke, run on chromium only (npm run e2e:smoke).
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const NOW = new Date('2026-11-14T10:00:00+01:00');
const WIDTHS = [320, 390, 768, 1440];
const SMOKE_WIDTHS = [390, 1440];
const CHAT_WIDTHS = [['w-phone', 340], ['w-livechat', 350], ['w-desk', 672]];
const smoke = (on) => (on ? { tag: '@smoke' } : {});

const test = base.extend({
  // uncaught page errors, checked after every test
  pageErrors: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await use(errors);
    expect(errors, 'uncaught errors on the page').toEqual([]);
  },
  // the gallery, loaded and drawn: offline (the Google Fonts link is refused), clock pinned
  gallery: async ({ page, pageErrors }, use) => {
    await page.clock.install({ time: NOW });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.goto('/');
    await page.waitForFunction(() => !!window.__gallerySetup);
    // every entry's chat has drawn its widget (the runtime scans the messages after setup)
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.chat[data-section]')]
      .filter((c) => !c.querySelector('.lbw[data-widget]')).map((c) => c.dataset.section))).toEqual([]);
    await use(page);
  },
});

// phones (≤ 500 px) are emulated as phones where the engine can (Firefox has no mobile emulation in Playwright)
const viewportFor = (width) => ({
  viewport: { width, height: 900 },
  isMobile: async ({ browserName }, use) => use(width < 500 && browserName !== 'firefox'),
  hasTouch: async ({ browserName }, use) => use(width < 500 && browserName !== 'firefox'),
});

const chat = (page, id) => page.locator(`.chat[data-section="${id}"]`);
const sent = (page, id) => page.locator(`#sent-${id} li`);
// a send from the keyboard (as the audit did: WebKit doesn't focus a clicked button, which would hide focus loss)
async function press(loc) { await loc.focus(); await loc.press('Enter'); }
const focusOnBody = (page) => page.evaluate(() => document.activeElement === document.body || !document.activeElement);
// what a page overflows by, sideways
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
// no sideways page scroll; when there is some, what sticks out (outside any scroll container) is named, and a known culprit is let through
async function expectNoSideways(page, where = '') {
  if (await sideways(page) <= 0) return;
  const out = await page.evaluate((known) => {
    const cw = document.documentElement.clientWidth, res = [];
    for (const x of document.querySelectorAll('body *')) {
      const r = x.getBoundingClientRect(); if (!r.width || r.right <= cw + 0.5) continue;
      let clipped = false;
      for (let a = x.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') { clipped = true; break; }
      if (clipped || (x.parentElement && x.parentElement.getBoundingClientRect().right > cw + 0.5)) continue;   // the outermost one only
      res.push({ el: `${x.tagName.toLowerCase()}.${String(x.className).split(' ')[0]} in #${(x.closest('[id]') || {}).id}`, known: !!(known && x.closest(known)) });
    }
    return res;
  }, KNOWN_WIDE);
  if (out.some((o) => o.known)) test.info().annotations.push({ type: 'known issue', description: 'gallery page: the "Piezas comunes" tables are wider than a 320 px screen' });
  expect(out.filter((o) => !o.known).map((o) => o.el), `what makes the page scroll sideways ${where}`).toEqual([]);
}
// let every finite animation end (entrances, pulses), so axe reads final colours
const settle = (page) => page.evaluate(() => Promise.all(document.getAnimations()
  .filter((a) => a.effect && a.effect.getComputedTiming().endTime !== Infinity).map((a) => a.finished.catch(() => {}))));

// Known findings, reported and not yet fixed: an axe node is let through when its rule matches and its HTML matches
// `html`. E2E_STRICT=1 lets nothing through. Remove an entry when its fix lands.
const STRICT = process.env.E2E_STRICT === '1';
const KNOWN = STRICT ? [] : [
  { rule: 'label-content-name-mismatch', html: /class="kit-cal-d\b/,
    why: 'accepted: a calendar day\'s name ("sábado, 14 de noviembre, 189 €") says more than its visible "14 189" on purpose, for screen readers (an experimental axe rule)' },
  { rule: 'target-size', html: /class="lbw-step-b"|class="lbw-tog"[^>]*data-k="(urbana|ebike)"/,
    why: 'library: the calc\'s sticky footer covers its controls while the card is scrolled part way into view' },
];
const knownIssue = (rule, html) => KNOWN.find((k) => k.rule === rule && k.html.test(html));
// gallery page: the "Piezas comunes" tables (.ref, first column nowrap, a 280 px grid minimum) are wider than a 320 px screen
const KNOWN_WIDE = null;   // fixed in the gallery: the reference grid fits 320 px

// ── render and layout, at each width ───────────────────────────────────────────────────────────────
for (const width of WIDTHS) {
  test.describe(`${width} px`, () => {
    test.use(viewportFor(width));
    const isSmoke = SMOKE_WIDTHS.includes(width);

    test('every type is drawn: a widget per entry, no raw tag, no setup error', smoke(isSmoke), async ({ gallery: page }) => {
      const r = await page.evaluate(() => ({
        sections: [...document.querySelectorAll('section.type')].map((s) => ({ id: s.id, widgets: s.querySelectorAll('.chat .lbw[data-widget]').length })),
        types: new Set([...document.querySelectorAll('section.type code.tname')].map((c) => c.textContent)).size,
        raw: [...document.querySelectorAll('.chat')].filter((c) => c.innerText.includes('[[')).map((c) => c.dataset.section),
        setupErrors: window.__kitSetupErrors,
        dropped: window.__lbwDropped || [],
      }));
      expect(r.types).toBe(20);
      expect(r.sections.length).toBeGreaterThanOrEqual(20);
      expect(r.sections.filter((s) => s.widgets < 1).map((s) => s.id), 'entries with no widget').toEqual([]);
      expect(r.raw, 'chats showing a raw [[tag]]').toEqual([]);
      expect(r.setupErrors).toEqual([]);
      expect(r.dropped, 'LBW dropped something at load').toEqual([]);
    });

    test('no sideways page scroll, and every widget fits its chat at each chat width', smoke(isSmoke), async ({ gallery: page }) => {
      await expectNoSideways(page);
      for (const [id, w] of CHAT_WIDTHS) {
        await page.locator(`#${id}`).click();
        await expect(page.locator(`#${id}`)).toHaveAttribute('aria-pressed', 'true');
        // a widget, and anything in it that isn't inside a scroll container, stays inside its chat column
        const out = await page.evaluate(() => {
          const bad = [];
          for (const c of document.querySelectorAll('.chat')) {
            const cr = c.getBoundingClientRect();
            for (const x of c.querySelectorAll('.lbw, .lbw *')) {
              const r = x.getBoundingClientRect(); if (!r.width || getComputedStyle(x).position === 'fixed') continue;
              let clipped = false;
              for (let a = x.parentElement; a && a !== c; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') { clipped = true; break; }
              if (!clipped && (r.right > cr.right + 1 || r.left < cr.left - 1)) bad.push(`${c.dataset.section}: ${x.tagName.toLowerCase()}.${String(x.className).split(' ')[0]} (${Math.round(r.left)}–${Math.round(r.right)} vs ${Math.round(cr.left)}–${Math.round(cr.right)})`);
            }
          }
          return bad;
        });
        expect(out, `widgets wider than the chat at the ${w} px chat width`).toEqual([]);
        await expectNoSideways(page, `at the ${w} px chat width`);
      }
    });

    // axe: no serious or critical violation, light and dark, motion reduced and not
    for (const colorScheme of ['light', 'dark']) {
      for (const reducedMotion of ['reduce', 'no-preference']) {
        test.describe(`${colorScheme}, motion ${reducedMotion}`, () => {
          test.use({ colorScheme, reducedMotion });
          test('axe: 0 serious or critical violations', smoke(isSmoke && colorScheme === 'light'), async ({ gallery: page }) => {
            if (reducedMotion === 'reduce') await expect(page.locator('html')).not.toHaveClass(/\blbw-motion\b/);
            await settle(page);
            const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
            const bad = [], known = new Set();
            for (const v of res.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
              const left = v.nodes.filter((n) => { const k = knownIssue(v.id, n.html); if (k) known.add(k.why); return !k; });
              if (left.length) bad.push(`${v.id} (${v.impact}): ${left.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}${left.length > 4 ? ` +${left.length - 4}` : ''}`);
            }
            for (const why of known) test.info().annotations.push({ type: 'known issue', description: why });
            expect(bad).toEqual([]);
          });
        });
      }
    }
  });
}

// ── interactions (light, motion on), on a phone and a desktop ──────────────────────────────────────
for (const width of SMOKE_WIDTHS) {
  test.describe(`interactions at ${width} px`, () => {
    test.use(viewportFor(width));
    const s = smoke(true);

    test('a pressed chip shows as sent, sends once and the others fold', s, async ({ gallery: page }) => {
      const w = chat(page, 'chips').locator('.lbw').first(), first = w.locator('button').first();
      await press(first);
      await expect(sent(page, 'chips')).toHaveCount(1);
      await expect(sent(page, 'chips').first()).toContainText('«¿Cuánto cuesta alquilar una bici?»');
      await expect(first).toHaveClass(/\bis-sent\b/);
      await expect(w).toHaveAttribute('data-lbw-job', 'sent');
      for (const other of await w.locator('button').all()) if (!(await other.evaluate((b) => b.classList.contains('is-sent')))) {
        await expect(other).toHaveClass(/\bis-folded\b/); await expect(other).toBeDisabled();
      }
      expect(await focusOnBody(page)).toBe(false);
    });

    test('a failed send shows «No se ha enviado · Reintentar» and Retry sends it once', s, async ({ gallery: page }) => {
      // the chat's sendMessage fails once as the network does ("Failed to fetch"), then works
      await page.evaluate(() => { const lb = window._landbot, ok = lb.sendMessage; let n = 0;
        lb.sendMessage = function (m) { if (n++ === 0) throw new TypeError('Failed to fetch'); return ok.call(this, m); }; });
      const w = chat(page, 'consent').locator('.lbw').first(), yes = w.locator('button[data-say="Sí, avisadme por SMS"]');
      await press(yes);
      const line = w.locator('.lbw-unsent');
      await expect(line).toBeVisible({ timeout: 8000 });
      await expect(line).toHaveAttribute('role', 'alert');
      await expect(line).toContainText('No se ha enviado.');
      await expect(yes).not.toHaveClass(/\bis-sent\b/);
      await expect(yes).toHaveClass(/\bis-unsent\b/);
      await expect(w.getByRole('button', { name: 'No', exact: true })).toBeEnabled();
      await expect(sent(page, 'consent')).toHaveCount(0);
      await press(line.getByRole('button', { name: 'Reintentar' }));
      await expect(sent(page, 'consent')).toHaveCount(1);
      await expect(sent(page, 'consent').first()).toContainText('gx_sms = si');
      await expect(line).toHaveCount(0);
      await expect(w).toHaveAttribute('data-lbw-job', 'sent');
      await expect(yes).toHaveClass(/\bis-sent\b/);
    });

    test('a rating sends its value and band once; a second press is refused', s, async ({ gallery: page }) => {
      const w = chat(page, 'rating').locator('.lbw[data-widget="nps"]'), nine = w.locator('button[data-v="9"]');
      await press(nine);
      await expect(sent(page, 'rating')).toHaveCount(1);
      await expect(sent(page, 'rating').first()).toContainText('«Mi nota: 9 de 10»');
      await expect(sent(page, 'rating').first()).toContainText('gx_nps = 9');
      await expect(sent(page, 'rating').first()).toContainText('gx_nps_grupo = promotor');
      await press(nine);   // the handler runs synchronously: a new job would be "queued" at once
      await expect(w).toHaveAttribute('data-lbw-job', 'sent');
      expect(await page.evaluate(() => window.__lbwSent.length)).toBe(1);
      await expect(w.locator('button[data-v="3"]')).toBeDisabled();
    });

    test('compact form: a pick folds its step and moves on, «Cambiar» reopens it, the CTA sends once', s, async ({ gallery: page }) => {
      const w = chat(page, 'form').locator('.lbw').first(), steps = w.locator('.kit-step');
      await expect(w.locator('.kit-step.is-open')).toHaveCount(1);
      await w.getByRole('radio', { name: /Quiero sudar/ }).click();
      await expect(steps.nth(0)).not.toHaveClass(/\bis-open\b/);
      await expect(steps.nth(0).locator('.kit-sum')).toContainText('Quiero sudar');
      await expect(steps.nth(0).locator('.kit-sum')).toContainText('Cambiar');
      await expect(steps.nth(1)).toHaveClass(/\bis-open\b/);
      await expect.poll(() => steps.nth(1).evaluate((s) => s.contains(document.activeElement))).toBe(true);
      // change the first answer
      await steps.nth(0).locator('.kit-sum').click();
      await expect(steps.nth(0)).toHaveClass(/\bis-open\b/);
      await w.getByRole('radio', { name: /Paseo tranquilo/ }).click();
      await expect(steps.nth(0).locator('.kit-sum')).toContainText('Paseo tranquilo');
      await w.getByRole('radio', { name: 'En pareja' }).click();
      await w.getByRole('button', { name: 'Casco' }).click();
      await expect(w.getByRole('button', { name: 'Casco' })).toHaveAttribute('aria-pressed', 'true');
      const cta = w.locator('.lbw-cta');
      await expect(cta).toHaveText('Enviar mi plan');
      await press(cta);
      await expect(sent(page, 'form')).toHaveCount(1);
      await expect(sent(page, 'form').first()).toContainText('gx_nivel = suave · gx_con = pareja · gx_extra = casco');
      await expect(w.locator('.kit-sentline')).toContainText('Enviado');
      await press(cta);
      await expect(w).toHaveAttribute('data-lbw-job', 'sent');
      expect(await page.evaluate(() => window.__lbwSent.length)).toBe(1);
    });

    test('calculator: the stepper and the segment update the total, which is sent with its fields', s, async ({ gallery: page }) => {
      const w = chat(page, 'calc').locator('.lbw').first(), total = w.locator('.kit-total strong');
      await expect(w.locator('output')).toHaveText('5');
      await expect(total).toHaveText('175,00 €');
      await press(w.getByRole('button', { name: 'Más · Días' }));
      await expect(w.locator('output')).toHaveText('6');
      await expect(total).toHaveText('210,00 €');
      await w.getByRole('radio', { name: 'Urbana' }).click();
      await expect(w.getByRole('radio', { name: 'Urbana' })).toHaveAttribute('aria-checked', 'true');
      await expect(total).toHaveText('90,00 €');
      await press(w.getByRole('button', { name: 'Enviar mi cálculo' }));
      await expect(sent(page, 'calc')).toHaveCount(1);
      await expect(sent(page, 'calc').first()).toContainText('gx_dias = 6 · gx_bici = urbana');
    });

    test('review: a changed line updates the total; Confirm sends it once', s, async ({ gallery: page }) => {
      const w = chat(page, 'review').locator('.lbw').first(), total = w.locator('.kit-rtotal strong');
      await expect(total).toHaveText('75 €');
      await w.locator('select').selectOption('no');
      await expect(total).toHaveText('45 €');
      const ok = w.getByRole('button', { name: 'Confirmar' });
      await press(ok);
      await expect(sent(page, 'review')).toHaveCount(1);
      await expect(sent(page, 'review').first()).toContainText('gx_presu = 4500');
      expect(await focusOnBody(page)).toBe(false);
    });

    test('slots: arrows move the day, a free hour books and the confirm card appears', s, async ({ gallery: page }) => {
      const w = chat(page, 'slots').locator('.lbw').first(), days = w.locator('.kit-day');
      await expect(days).toHaveCount(3);
      await expect(days.nth(0)).toHaveAttribute('aria-checked', 'true');
      await expect(w.locator('.kit-slot.is-busy')).toBeDisabled();   // Monday 10:00 is taken
      await days.nth(0).focus(); await page.keyboard.press('ArrowRight');
      await expect(days.nth(1)).toHaveAttribute('aria-checked', 'true');
      await expect(w.locator('.kit-slot').first()).toHaveText('10:00–11:00');   // Wednesday's hours
      await w.locator('.kit-slot').first().click();
      const cta = w.locator('.lbw-cta');
      await expect(cta).toHaveText('Reservar');
      await press(cta);
      await expect(sent(page, 'slots')).toHaveCount(1);
      await expect(sent(page, 'slots').first()).toContainText('gx_dia = 18/11/2026 · gx_hora = 10:00');
      await expect(chat(page, 'confirm').locator('.lbw[data-widget="hecho"]')).toHaveCount(2);
    });

    test('calendar: keyboard moves in one Tab stop, a full day is refused, two taps pick a stay sent once', s, async ({ gallery: page }) => {
      const w = chat(page, 'calendar').locator('.lbw').first();
      const day = (label) => w.locator(`.kit-cal-d[aria-label^="${label}"]`);
      const focused = () => page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label'));
      await expect(w.locator('.kit-cal-d[tabindex="0"]')).toHaveCount(1);
      await w.locator('.kit-cal-d[tabindex="0"]').focus();
      expect(await focused()).toMatch(/^sábado, 21 de noviembre/);   // the tag's preset arrival
      await page.keyboard.press('ArrowRight'); expect(await focused()).toMatch(/^domingo, 22 de noviembre/);
      await page.keyboard.press('ArrowUp'); expect(await focused()).toMatch(/^domingo, 15 de noviembre/);
      await page.keyboard.press('Home'); expect(await focused()).toMatch(/^lunes, 9 de noviembre/);
      await page.keyboard.press('End'); expect(await focused()).toMatch(/^domingo, 15 de noviembre/);
      await page.keyboard.press('PageDown'); expect(await focused()).toMatch(/^martes, 15 de diciembre/);
      await page.keyboard.press('PageUp'); expect(await focused()).toMatch(/^domingo, 15 de noviembre/);
      await expect(w.locator('.kit-cal-d[tabindex="0"]')).toHaveCount(1);
      // a full day says so and isn't picked
      if (!(await day('sábado, 5 de diciembre').isVisible())) await w.locator('.kit-cal-nav.is-next').click();
      await expect(day('sábado, 5 de diciembre')).toHaveAttribute('aria-label', /completo/);
      await press(day('sábado, 5 de diciembre'));   // aria-disabled: Playwright won't click it, a keyboard user can press it
      await expect(day('sábado, 5 de diciembre')).not.toHaveAttribute('aria-pressed', 'true');
      if (!(await day('lunes, 16 de noviembre').isVisible())) await w.locator('.kit-cal-nav.is-prev').click();
      await day('lunes, 16 de noviembre').click();
      await day('jueves, 19 de noviembre').click();
      await expect(w.locator('.kit-cal-sum')).toHaveText('Del 16 al 19 nov · 3 noches · desde 567 €');
      const cta = w.locator('.lbw-cta');
      await press(cta);
      await expect(sent(page, 'calendar')).toHaveCount(1);
      await expect(sent(page, 'calendar').first()).toContainText('gx_noches = 3');
      await expect(w.locator('.kit-sentline')).toBeVisible();
      await press(cta);
      await expect(w).toHaveAttribute('data-lbw-job', 'sent');
      expect(await page.evaluate(() => window.__lbwSent.length)).toBe(1);
      expect(await focusOnBody(page)).toBe(false);
    });

    test('map: a pin selects its row and the reverse, arrows move between pins, directions open a new tab', s, async ({ gallery: page }) => {
      const w = chat(page, 'map').locator('.lbw').first(), pins = w.locator('.kit-map-pin'), rows = w.locator('.kit-map-place');
      await expect(pins.nth(1)).toHaveAttribute('aria-checked', 'true');   // id=taller
      await pins.nth(0).click();
      await expect(pins.nth(0)).toHaveAttribute('aria-checked', 'true');
      await expect(rows.nth(0)).toHaveClass(/\bis-on\b/);
      await expect(w.locator('.kit-map-place.is-on')).toHaveCount(1);
      await rows.nth(2).locator('.kit-map-pick').click();
      await expect(pins.nth(2)).toHaveAttribute('aria-checked', 'true');
      await expect(w.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
      await pins.nth(2).focus(); await page.keyboard.press('ArrowLeft');
      await expect(pins.nth(1)).toHaveAttribute('aria-checked', 'true');
      await expect(pins.nth(1)).toBeFocused();
      const go = rows.nth(0).getByRole('link', { name: 'Cómo llegar ↗' });
      await expect(go).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/dir\//);
      await expect(go).toHaveAttribute('target', '_blank');
      await expect(go).toHaveAttribute('rel', /noopener/);
    });

    test('tracker: the older card is quiet and spent, the newest sends its fields and keeps focus', s, async ({ gallery: page }) => {
      const cards = chat(page, 'tracker').locator('.lbw[data-widget="pedido"]');
      await expect(cards.nth(0)).toHaveClass(/\bis-old\b/);
      await expect(cards.nth(0).locator('.kit-trk-upd')).toHaveText('Actualizado: Lista para recoger');
      await expect(cards.nth(0).getByRole('button', { name: 'Avisadme cuando llegue' })).toBeDisabled();
      await expect(cards.nth(1)).not.toHaveClass(/\bis-old\b/);
      const go = cards.nth(1).getByRole('button', { name: 'Voy a recogerla' });
      await press(go);
      await expect(sent(page, 'tracker')).toHaveCount(1);
      await expect(sent(page, 'tracker').first()).toContainText('estado = recogida · gx_orden = RN-2318');
      await expect(go).toBeFocused();
    });

    test('carousel: a three-slide strip scrolls with the arrow keys and its reply sends once', s, async ({ gallery: page }) => {
      // the gallery's carousel is filtered to one slide: a new agent message with the plain tag draws all three
      await page.evaluate(() => { const c = document.querySelector('.chat[data-section="carousel"]');
        const r = document.createElement('div'); r.className = 'row is-bot'; r.setAttribute('data-lb-part', 'message'); r.setAttribute('data-lb-author', 'bot');
        const b = document.createElement('div'); b.className = 'bubble'; const t = document.createElement('div'); t.setAttribute('data-lb-part', 'message-text');
        t.textContent = 'Estas son las bicis: [[gx:bicis lang=es]]'; b.appendChild(t); r.appendChild(b); c.appendChild(r); });
      const w = chat(page, 'carousel').locator('.lbw[data-widget="bicis"]').last();
      await expect(w.locator('.lbw-slide')).toHaveCount(3);
      const strip = w.locator('.lbw-strip');
      await strip.scrollIntoViewIfNeeded();
      await strip.focus();
      expect(await strip.evaluate((s) => s.scrollWidth > s.clientWidth)).toBe(true);
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => strip.evaluate((s) => s.scrollLeft)).toBeGreaterThan(0);
      const reply = w.getByRole('button', { name: 'La urbana' });
      await press(reply);
      await expect(sent(page, 'carousel')).toHaveCount(1);
      await expect(sent(page, 'carousel').first()).toContainText('«Quiero la urbana»');
    });

    test('compare: the best column is marked and its reply is the primary one', s, async ({ gallery: page }) => {
      const w = chat(page, 'compare').locator('.lbw').first();
      await expect(w).toContainText('La más alquilada');
      await expect(w.getByRole('button', { name: 'La eléctrica' })).toHaveClass(/\bis-primary\b/);
      await expect(w.getByRole('button', { name: 'La urbana' })).not.toHaveClass(/\bis-primary\b/);
      await press(w.getByRole('button', { name: 'La eléctrica' }));
      await expect(sent(page, 'compare')).toHaveCount(1);
      await expect(sent(page, 'compare').first()).toContainText('«Quiero la eléctrica»');
    });

    test('live data: without the Code block the saved copy draws, with it the table is live again', s, async ({ gallery: page }) => {
      const c = chat(page, 'data'), sim = page.locator('#sim-data'), tables = c.locator('.lbw[data-widget="hoy"]');
      await expect(tables).toHaveCount(1);
      await expect(tables.first()).toContainText('En directo');
      await sim.click();
      await expect(sim).toHaveAttribute('aria-pressed', 'true');
      await expect(tables).toHaveCount(2, { timeout: 8000 });
      await expect(tables.nth(1)).toContainText('Hoy salen');
      await expect(tables.nth(1)).not.toContainText('En directo');
      await sim.click();
      await expect(tables).toHaveCount(3, { timeout: 8000 });
      await expect(tables.nth(2)).toContainText('En directo');
      await expect(tables.nth(2)).toContainText('Ría de Bilbao');
    });
  });
}
