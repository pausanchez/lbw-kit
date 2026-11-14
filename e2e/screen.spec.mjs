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

  test('«Ver conversación» shows the earlier messages and folds them again; focus stays on it', { tag: '@smoke' }, async ({ demo: page }) => {
    await toNights(page);
    const hist = head(page).getByRole('button', { name: 'Ver conversación' });
    await expect(hist).toHaveAttribute('aria-expanded', 'false');
    await press(hist);
    await expect(hist).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.lbw[data-widget="plan"]')).toBeVisible();
    await expect(page.getByText('Hola, soy el asistente de Roda Norte')).toBeVisible();
    await expect(hist).toBeFocused();
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
