import { expect, test, type Page } from '@playwright/test';

async function button(page: Page, name: string) {
  await page.waitForFunction((n) => window.__TCSS__?.buttonClient(n)?.enabled, name);
  const p = await page.evaluate((n) => window.__TCSS__!.buttonClient(n)!, name);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}
async function selectRegion(page: Page, id: string) {
  const p = await page.evaluate((id) => {
    const game = (window as any).__PHASER_GAME__;
    const hud = game.scene.getScene('HudScene');
    const r = window.__TCSS__!.snapshot().meta.regions.find((r) => r.id === id)!;
    const pt = hud.worldMapHud.mapRoot.getWorldTransformMatrix().transformPoint(10 + r.pos.x, 36 + r.pos.y);
    const cam = hud.cameras.main;
    const rect = game.canvas.getBoundingClientRect();
    return { x: rect.left + (pt.x - cam.worldView.x) * cam.zoom * rect.width / hud.scale.width,
      y: rect.top + (pt.y - cam.worldView.y) * cam.zoom * rect.height / hud.scale.height };
  }, id);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test.describe(`viewport ${viewport.width}`, () => {
  test.use({ hasTouch: viewport.width < 1100, isMobile: viewport.width < 900 });
  test(`regional land, construction, visits and persistence ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?map=farm&cheat=1&skipStory=1');
    await page.waitForFunction(() => window.__TCSS__?.ready);
    await button(page, 'world.open');
    await selectRegion(page, 'old_town');
    const before = await page.evaluate(() => window.__TCSS__!.snapshot().economy.coins);
    await page.screenshot({ path: `docs/screenshots/regions-before-${viewport.width}.png` });
    await button(page, 'world.land');
    await expect.poll(() => page.evaluate(() => window.__TCSS__!.snapshot().estates.find((e) => e.id === 'old_town')!.owned)).toBe(true);
    await button(page, 'world.farm');
    await button(page, 'world.cafe');
    expect(await page.evaluate(() => window.__TCSS__!.snapshot().economy.coins)).toBe(before - 1800);
    await page.screenshot({ path: `docs/screenshots/regions-${viewport.width}.png` });
    // The second page contains farms; all profiles are reachable through pagination.
    await button(page, 'world.next');
    await button(page, 'world.next');
    await button(page, 'world.visit.farm_old_town_0');
    await page.screenshot({ path: `docs/screenshots/regions-farm-visit-${viewport.width}.png` });
    await button(page, 'world.back');
    await button(page, 'world.farm');
    await page.waitForFunction(() => window.__TCSS__?.snapshot().map === 'old_town__farm');
    expect(await page.evaluate(() => window.__TCSS__!.snapshot().farm.plots.every((p) => p.id.startsWith('old_town__farm:')))).toBe(true);
    await page.screenshot({ path: `docs/screenshots/regions-play-${viewport.width}.png` });
    await page.evaluate(() => window.__TCSS__!.saveNow());
    await page.goto('/?skipStory=1');
    await page.waitForFunction(() => window.__TCSS__?.snapshot().map === 'old_town__farm');
    await button(page, 'toolbar.travel');
    await page.waitForFunction(() => window.__TCSS__?.snapshot().map === 'old_town__cafe');
    expect(errors).toEqual([]);
  });
  });
}
