// Screen mode (runtime/screen.js) in a real browser: site/screen.html, the gallery's "Modo pantalla" demo, a fake v4 chat
// whose scripted bot walks form (compact) → calendar → confirm pass. A screen change moves focus and says the step, "Ver
// conversación" shows the history, typing still works and the agent's free text is a bubble on the screen, the bar mirrors
// the primary action, reduced motion moves nothing, the three chat widths, and axe.
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
  // the demo, loaded, its first screen drawn. The bot answers after 150 ms; every [data-lbw-in] (a screen rising in) is noted
  demo: async ({ page, pageErrors }, use) => {
    await page.clock.install({ time: NOW });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript(() => {
      window.__screenDelay = 150; window.__inSeen = 0;
      new MutationObserver((rs) => { for (const r of rs) if (r.attributeName === 'data-lbw-in' && r.target.hasAttribute('data-lbw-in')) window.__inSeen++; })
        .observe(document, { subtree: true, attributes: true, attributeFilter: ['data-lbw-in'] });
    });
    await page.goto('/screen.html');
    await expect.poll(() => page.evaluate(() => window.LBW && LBW.screen.state() && LBW.screen.state().step)).toBe('plan');
    await use(page);
  },
});
const phone = { viewport: { width: 390, height: 844 }, isMobile: async ({ browserName }, use) => use(browserName !== 'firefox'), hasTouch: async ({ browserName }, use) => use(browserName !== 'firefox') };
const state = (page) => page.evaluate(() => LBW.screen.state());
const head = (page) => page.locator('[data-lbw-slot="head"]');
// how far the first message's row is from where "View conversation" puts it (8 px under the column's top edge)
const firstOff = (page) => page.evaluate(() => { const c = document.querySelector('.col'), r = document.querySelector('.row'); return Math.abs(r.getBoundingClientRect().top - c.getBoundingClientRect().top - 8); });
async function press(loc) { await loc.focus(); await loc.press('Enter'); }
// the first screen, answered from the keyboard: the plan form sends, the bot answers with the calendar
async function toNights(page) {
  const form = page.locator('.lbw[data-widget="plan"]');
  await form.getByRole('radio', { name: /Paseo tranquilo/ }).click();
  await form.getByRole('radio', { name: 'En pareja' }).click();
  await form.getByRole('button', { name: 'Casco' }).click();
  await press(form.locator('.lbw-cta'));
  await expect.poll(() => state(page).then((s) => s.step)).toBe('noches');
  return page.locator('.lbw[data-widget="noches"]');
}
async function pickNights(cal) {
  const day = (label) => cal.locator(`.kit-cal-d[aria-label^="${label}"]`);
  await day('lunes, 16 de noviembre').click();
  await day('jueves, 19 de noviembre').click();
  await expect(cal.locator('.kit-cal-sum')).toContainText('3 noches');
}

test.describe('screen mode at 390 px', () => {
  test.use(phone);

  test('form → calendar → pass: each is a screen; the step, focus on the new heading, the step said, earlier messages folded but kept', { tag: '@smoke' }, async ({ demo: page }) => {
    await expect(head(page).locator('li[aria-current="step"]')).toHaveText('Tu plan');
    await expect(head(page).locator('.lbw-scr-title')).toHaveText('Reserva la cabaña');
    await expect(page.getByText('Hola, soy el asistente de Roda Norte')).toBeVisible();   // the first screen's turn: nothing folded yet
    await expect(head(page).getByRole('button', { name: 'Ver conversación' })).toBeHidden();
    const cal = await toNights(page);
    await expect(cal).toBeVisible();
    await expect(head(page).locator('li[aria-current="step"]')).toContainText('Noches');
    await expect(head(page).locator('li.is-done')).toHaveText('✓ Tu plan, hecho');
    await expect.poll(() => page.evaluate(() => !!document.activeElement && document.activeElement.matches('.lbw[data-widget="noches"] .lbw-title'))).toBe(true);
    await expect.poll(() => page.evaluate(() => (window.__lbwAnnounced || []).join(' | '))).toContain('Paso 2 de 3: Noches');
    // folded: hidden, still in the DOM; the agent's bubble that opens this turn stays
    const form = page.locator('.lbw[data-widget="plan"]');
    await expect(form).toHaveCount(1); await expect(form).toBeHidden();
    await expect(page.getByText('Hola, soy el asistente de Roda Norte')).toBeHidden();
    await expect(page.getByText('Perfecto. Con ese plan')).toBeVisible();
    expect(await page.locator('[data-lbw-past]').count()).toBe(3);
    // the third screen: the tag names the step (step=listo)
    await pickNights(cal);
    await press(cal.locator('.lbw-cta'));
    await expect.poll(() => state(page).then((s) => s.step)).toBe('listo');
    await expect(page.locator('.lbw[data-widget="reserva"]')).toBeVisible();
    await expect(head(page).locator('li.is-done')).toHaveCount(2);
    expect(await page.evaluate(() => window.__screenSent.map((x) => x.fields.gx_noches || x.fields.gx_nivel))).toEqual(['suave', '3']);
    expect(await page.evaluate(() => window.__kitSetupErrors)).toEqual([]);
    expect(await page.evaluate(() => (window.__lbwDropped || []).filter((x) => /^screen/.test(String(x))))).toEqual([]);
  });

  // v0.13.0.1: opening takes focus to the first earlier message (it stayed on the toggle, and the history opened out of sight)
  test('«Ver conversación» shows the earlier messages, focused at their start, and folds them again; focus back on the toggle', { tag: '@smoke' }, async ({ demo: page }) => {
    await toNights(page);
    const hist = head(page).getByRole('button', { name: 'Ver conversación' });
    await expect(hist).toHaveAttribute('aria-expanded', 'false');
    await press(hist);
    await expect(hist).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.lbw[data-widget="plan"]')).toBeVisible();
    await expect(page.getByText('Hola, soy el asistente de Roda Norte')).toBeVisible();
    await expect(page.locator('.msg').first()).toBeFocused();
    expect((await state(page)).open).toBe(true);
    await press(hist);
    await expect(hist).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.lbw[data-widget="plan"]')).toBeHidden();
    await expect(hist).toBeFocused();
  });

  test('the visitor can still type; the agent\'s free text is a bubble on the current screen, which stays', { tag: '@smoke' }, async ({ demo: page }) => {
    const cal = await toNights(page);
    const box = page.getByRole('textbox', { name: 'Escribe un mensaje' });
    await expect(box).toBeVisible(); await expect(box).toBeEnabled();
    await box.fill('¿Admitís perros?'); await box.press('Enter');
    await expect(page.getByText('Sí, admitimos perros pequeños')).toBeVisible();
    await expect(page.locator('.msg[data-lb-author="user"]').last()).toHaveText('¿Admitís perros?');
    await expect(box).toBeFocused();
    await expect(cal).toBeVisible();
    const s = await state(page); expect([s.step, s.widget]).toEqual(['noches', 'noches']);
    // and the screen still works after it
    await pickNights(cal);
    await press(cal.locator('.lbw-cta'));
    await expect.poll(() => state(page).then((x) => x.step)).toBe('listo');
    await expect(page.getByText('Sí, admitimos perros pequeños')).toBeHidden();   // it was before this turn: folded with the rest
  });

  test('the bar mirrors the primary action while it is out of view; a press on it is the original\'s, sent once', async ({ demo: page }) => {
    const cal = await toNights(page), bar = page.locator('[data-lbw-slot="bar"]'), go = bar.locator('button');
    await page.locator('.col').evaluate((c) => { c.scrollTop = 0; });
    await expect(bar).toBeHidden();   // not ready yet: the card's own CTA says what is missing
    await pickNights(cal);
    await page.locator('.col').evaluate((c) => { c.scrollTop = 0; });
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('aria-hidden', 'true');
    await expect(go).toHaveAttribute('tabindex', '-1');
    await expect(go).toHaveText((await cal.locator('.lbw-cta').textContent()).trim());
    await expect(bar.locator('.lbw-scr-sum')).toContainText('3 noches');
    await cal.locator('.lbw-cta').scrollIntoViewIfNeeded();
    await expect(bar).toBeHidden();   // the original is in view: no double
    await page.locator('.col').evaluate((c) => { c.scrollTop = 0; });
    await expect(bar).toBeVisible();
    await go.click();
    await expect.poll(() => state(page).then((x) => x.step)).toBe('listo');
    expect(await page.evaluate(() => window.__screenSent.length)).toBe(2);
    expect(await page.evaluate(() => window.__lbwSent.length)).toBe(2);
  });

  test.describe('motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('reduced motion: no rise, the screen is drawn at once; focus and the step still move', async ({ demo: page }) => {
      await expect(page.locator('html')).not.toHaveClass(/\blbw-motion\b/);
      await toNights(page);
      await expect.poll(() => page.evaluate(() => !!document.activeElement && document.activeElement.matches('.lbw[data-widget="noches"] .lbw-title'))).toBe(true);
      expect(await page.evaluate(() => window.__inSeen)).toBe(0);
    });
  });
  test('with motion, the new screen rises in (under html.lbw-motion)', async ({ demo: page }) => {
    await expect(page.locator('html')).toHaveClass(/\blbw-motion\b/);
    await toNights(page);
    expect(await page.evaluate(() => window.__inSeen)).toBeGreaterThan(0);
  });
});

// the three columns the docs measure: 340 (a phone), 350 (a Livechat window), 672 (tablet and desktop). The list's padding
// is 12 px a side, so the page is 24 px wider
for (const col of [340, 350, 672]) {
  test.describe(`a ${col} px column`, () => {
    test.use({ viewport: { width: col + 24, height: 800 } });
    test('the header, the screen and the bar fit; nothing scrolls sideways', async ({ demo: page }) => {
      const cal = await toNights(page);
      await pickNights(cal);
      await page.locator('.col').evaluate((c) => { c.scrollTop = 0; });
      const out = await page.evaluate(() => {
        const cw = document.documentElement.clientWidth, bad = [];
        for (const x of document.querySelectorAll('[data-lbw-slot] *, .lbw[data-widget="noches"] *')) {
          const r = x.getBoundingClientRect(); if (!r.width) continue;
          let clipped = false; for (let a = x.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible' && !a.matches('.col, .win')) { clipped = true; break; }
          if (!clipped && (r.right > cw + 0.5 || r.left < -0.5)) bad.push(`${x.tagName.toLowerCase()}.${String(x.className).split(' ')[0]}`);
        }
        return { bad, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      expect(out.bad).toEqual([]); expect(out.sideways).toBeLessThanOrEqual(0);
      await expect(page.locator('[data-lbw-slot="bar"]')).toBeVisible();
      const h = await head(page).boundingBox(); expect(h.height).toBeLessThan(110);
    });
  });
}

// axe on both screens, light and dark, motion reduced (final colours at once)
for (const colorScheme of ['light', 'dark']) {
  test.describe(`axe, ${colorScheme}`, () => {
    test.use({ ...phone, colorScheme, reducedMotion: 'reduce' });
    test('0 serious or critical violations on the first and the second screen, history folded and shown', colorScheme === 'light' ? { tag: '@smoke' } : {}, async ({ demo: page }) => {
      const run = async (where) => {
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        // accepted in the gallery too (e2e/gallery.spec.mjs KNOWN): a calendar day's name says more than its visible "14 189"
        const known = (v, n) => v.id === 'label-content-name-mismatch' && /class="kit-cal-d\b/.test(n.html);
        const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !known(v, n)) })).filter((v) => v.nodes.length)
          .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(bad, where).toEqual([]);
      };
      await run('first screen');
      await toNights(page);
      await run('second screen');
      await press(head(page).getByRole('button', { name: 'Ver conversación' }));
      await run('history shown');
    });
  });
}

// ── v2 polish: steps done only when left forward, history that keeps the screen in view, "bleed" ────────────────────
test.describe('screen mode polish at 390 px', () => {
  test.use(phone);

  test('a step jumped over is skipped, not done; the ✓ comes only from moving forward', { tag: '@smoke' }, async ({ demo: page }) => {
    // the agent goes straight from the plan to the last step: Noches never ran
    await page.evaluate(() => window.__bot('Vamos directo al final: [[gx:noches step=listo]]'));
    await expect.poll(() => state(page).then((s) => s.step)).toBe('listo');
    const lis = head(page).locator('li');
    await expect(lis.nth(0)).toHaveClass('is-done'); await expect(lis.nth(0)).toContainText('✓');
    await expect(lis.nth(1)).toHaveClass('is-skip'); await expect(lis.nth(1)).not.toContainText('✓');
    await expect(lis.nth(1)).toHaveText('Noches, omitido');
    await expect(lis.nth(2)).toHaveAttribute('aria-current', 'step');
    expect((await state(page)).done).toEqual(['plan']);
  });

  // v0.13.0.1: the live tests found the history opening out of sight; it now takes the visitor to its start
  test('«Ver conversación» takes the visitor to the start of the history; folding it puts the screen back where it was', { tag: '@smoke' }, async ({ demo: page }) => {
    const cal = await toNights(page), title = cal.locator('.lbw-title');
    await page.waitForTimeout(2700);   // lbw.js places a new reply for 2.5 s (reveal); measure once it rests
    const y0 = (await title.boundingBox()).y;
    await press(head(page).getByRole('button', { name: 'Ver conversación' }));
    await expect.poll(() => firstOff(page)).toBeLessThan(2);
    await expect(page.getByText('Hola, soy el asistente de Roda Norte')).toBeInViewport();
    await expect(page.locator('.msg').first()).toBeFocused();
    await page.locator('.col').evaluate((c) => { c.scrollTop = c.scrollTop + 40; });   // the visitor reads on
    await press(head(page).getByRole('button', { name: 'Ver conversación' }));
    await expect.poll(async () => Math.abs((await title.boundingBox()).y - y0)).toBeLessThan(2);
    await expect(title).toBeInViewport();
  });

  test('opened within 2.5 s of a new step, the history wins: lbw.js\'s pending reveal no longer drags the screen back', async ({ demo: page }) => {
    const cal = await toNights(page), title = cal.locator('.lbw-title');
    await page.waitForTimeout(300);   // inside the reveal's 2.5 s hold (the live bug: 74–77 px off at 390)
    // where the screen is, and the click, in one go: the hold may still move it until the click ends it
    const y0 = await page.evaluate(() => { const y = document.querySelector('.lbw[data-widget="noches"] .lbw-title').getBoundingClientRect().y; document.querySelector('.lbw-scr-hist').click(); return y; });
    await expect.poll(() => firstOff(page)).toBeLessThan(2);
    await page.waitForTimeout(2600);   // past every pass of the hold
    expect(await firstOff(page)).toBeLessThan(2);
    await press(head(page).getByRole('button', { name: 'Ver conversación' }));
    await page.waitForTimeout(400);
    expect(Math.abs((await title.boundingBox()).y - y0)).toBeLessThan(2);
  });

  test('on a smooth-scrolling column (as v4\'s), opening and folding the history are single jumps, never a slide', async ({ demo: page }) => {
    await page.goto('/screen.html?smooth=1');
    await expect.poll(() => page.evaluate(() => window.LBW && LBW.screen.state() && LBW.screen.state().step)).toBe('plan');
    await toNights(page);
    await page.waitForTimeout(2800);
    expect(await page.locator('.col').evaluate((c) => getComputedStyle(c).scrollBehavior)).toBe('smooth');
    // every frame for 450 ms after the click: where the first message (open) and the screen's title (fold) are
    const frames = (sel) => page.evaluate((sel) => new Promise((done) => {
      const el = () => document.querySelector(sel), out = [], t0 = performance.now();
      document.querySelector('.lbw-scr-hist').click();
      (function tick() { out.push(Math.round(el().getBoundingClientRect().top)); if (performance.now() - t0 < 450) requestAnimationFrame(tick); else done(out); })();
    }), sel);
    const open = await frames('.msg'), shut = await frames('.lbw[data-widget="noches"] .lbw-title');
    expect([...new Set(open)].length, 'open: ' + open.join(',')).toBe(1);
    expect([...new Set(shut)].length, 'fold: ' + shut.join(',')).toBe(1);
    expect(await page.locator('.col').evaluate((c) => getComputedStyle(c).scrollBehavior)).toBe('smooth');
  });

  test('"hideHost": Landbot\'s header hides while screen mode runs; the screen header carries the title', async ({ demo: page }) => {
    await expect(page.locator('[data-lb-part="header"]')).toBeVisible();   // off by default
    await page.goto('/screen.html?hidehost=1');
    await expect.poll(() => page.evaluate(() => window.LBW && LBW.screen.state() && LBW.screen.state().step)).toBe('plan');
    await expect(page.locator('[data-lb-part="header"]')).toBeHidden();
    await expect(page.locator('.win-top')).toBeHidden();
    await expect(head(page).locator('.lbw-scr-title')).toHaveText('Reserva la cabaña');
    expect(await page.evaluate(() => LBW.host.check(null, { header: true }).ok)).toBe(true);
    const h = await head(page).boundingBox(); expect(h.y).toBeLessThan(2);   // the screen header is the top of the chat
    await toNights(page);
    await expect(page.locator('[data-lb-part="header"]')).toBeHidden();
    await expect(page.getByRole('textbox', { name: 'Escribe un mensaje' })).toBeVisible();
  });

  test('"bar": "always" docks the ready action even while the card\'s own button is in view; a press sends once', async ({ demo: page }) => {
    await page.goto('/screen.html?bar=always');
    await expect.poll(() => page.evaluate(() => window.LBW && LBW.screen.state() && LBW.screen.state().step)).toBe('plan');
    const cal = await toNights(page), bar = page.locator('[data-lbw-slot="bar"]'), go = bar.locator('button');
    await expect(bar).toBeHidden();   // not ready: the card says what is missing
    await pickNights(cal);
    await cal.locator('.lbw-cta').scrollIntoViewIfNeeded();
    await expect(cal.locator('.lbw-cta')).toBeInViewport();
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('aria-hidden', 'true'); await expect(go).toHaveAttribute('tabindex', '-1');
    await go.click();
    await expect.poll(() => state(page).then((x) => x.step)).toBe('listo');
    expect(await page.evaluate(() => window.__screenSent.length)).toBe(2);
  });
});

// v0.13.0.1 · a wide window: v4's chat spans it, its column is 720 px (.responsive-container); the header and the bar keep to it
test.describe('screen mode at 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('the header and the bar sit on the chat\'s column, not across the window', async ({ demo: page }) => {
    await page.goto('/screen.html?bar=always');   // the whole step fits at 900 px: the bar shows only when docked always
    await expect.poll(() => page.evaluate(() => window.LBW && LBW.screen.state() && LBW.screen.state().step)).toBe('plan');
    const cal = await toNights(page);
    await pickNights(cal);
    await expect(page.locator('[data-lbw-slot="bar"]')).toBeVisible();
    const box = async (sel) => page.locator(sel).evaluate((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; });
    const col = await box('.list');
    expect(col).toEqual([360, 720]);
    expect(await box('[data-lbw-slot="head"]')).toEqual(col);
    expect(await box('[data-lbw-slot="bar"]')).toEqual(col);
  });
});

test.describe('bleed at 390 px', () => {
  test.use(phone);
  const bleed = async (page) => {
    await page.goto('/screen.html?bleed=1');
    await expect.poll(() => page.evaluate(() => window.LBW && LBW.screen.state() && LBW.screen.state().step)).toBe('plan');
  };

  test('the screen drops its card and bubble: its short text is the heading, its widget fills the column', { tag: '@smoke' }, async ({ demo: page }) => {
    await bleed(page);
    const cal = await toNights(page), row = page.locator('[data-lbw-cur]').last();
    await expect(row).toContainText('Elige tus noches');
    const look = await page.evaluate(() => {
      const box = document.querySelector('.lbw[data-widget="noches"] > .lbw-box'), cs = getComputedStyle(box);
      const t = [...document.querySelectorAll('[data-lbw-chrome="title"]')].pop(), bub = t.parentElement, list = document.querySelector('.list');
      const lr = list.getBoundingClientRect(), wr = document.querySelector('.lbw[data-widget="noches"]').getBoundingClientRect();
      return { border: cs.borderTopWidth, shadow: cs.boxShadow, title: getComputedStyle(t).fontSize, bubbleBg: getComputedStyle(bub).backgroundColor, bubblePad: getComputedStyle(bub).paddingLeft,
        intro: !!document.querySelector('[data-lbw-cur] [data-lbw-chrome="intro"]'), left: Math.round(wr.left - lr.left), right: Math.round(lr.right - wr.right) };
    });
    expect(look).toEqual({ border: '0px', shadow: 'none', title: '24px', bubbleBg: 'rgba(0, 0, 0, 0)', bubblePad: '0px', intro: true, left: 0, right: 0 });
    // the earlier screen got its card back when it folded; history shows it as before
    await press(head(page).getByRole('button', { name: 'Ver conversación' }));
    expect(await page.locator('.lbw[data-widget="plan"] > .lbw-box').evaluate((b) => getComputedStyle(b).borderTopWidth)).not.toBe('0px');
    await expect(cal).toBeVisible();
  });

  test('the screen\'s replies and actions are full-width rows', async ({ demo: page }) => {
    await bleed(page);
    const cal = await toNights(page);
    await pickNights(cal);
    await press(cal.locator('.lbw-cta'));
    await expect.poll(() => state(page).then((s) => s.step)).toBe('listo');
    const pass = page.locator('.lbw[data-widget="reserva"]');
    const w = await pass.boundingBox(), pills = pass.locator('.lbw-actions .lbw-pill');
    expect(await pills.count()).toBeGreaterThanOrEqual(2);
    for (const p of await pills.all()) { const b = await p.boundingBox(); expect(Math.abs(b.width - (w.width - 24))).toBeLessThan(2); }
  });

  for (const colorScheme of ['light', 'dark']) {
    test.describe(`axe, bleed, ${colorScheme}`, () => {
      test.use({ colorScheme, reducedMotion: 'reduce' });
      test('0 serious or critical violations on the bleed screens', async ({ demo: page }) => {
        await bleed(page);
        const run = async (where) => {
          const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
          const known = (v, n) => v.id === 'label-content-name-mismatch' && /class="kit-cal-d\b/.test(n.html);
          const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !known(v, n)) })).filter((v) => v.nodes.length)
            .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
          expect(bad, where).toEqual([]);
        };
        await run('first screen');
        const cal = await toNights(page); await run('second screen');
        await pickNights(cal); await press(cal.locator('.lbw-cta'));
        await expect.poll(() => state(page).then((s) => s.step)).toBe('listo');
        await run('the pass');
      });
    });
  }
});
