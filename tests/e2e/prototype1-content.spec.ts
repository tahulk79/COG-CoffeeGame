import { expect, test, type Page } from '@playwright/test';

const gags = ['banana', 'durian', 'water', 'shuttlecock', 'dog', 'cat', 'sinkhole', 'laundry', 'motorbike', 'slipper', 'pigeons', 'chickens'];
async function ready(page: Page) {
  await page.goto('/?fresh=1&story=1&close=1');
  await page.waitForFunction(() => window.__TCSS__?.ready && !(window as any).__PHASER_GAME__.scene.isActive('TransitionScene'));
}

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
  test.describe(`prototype 1 content ${viewport.width}`, () => {
    test.use({ viewport, hasTouch: viewport.width < 900, isMobile: viewport.width < 900 });
    test('renders all 12 gags without missing art or runtime errors', async ({ page }, info) => {
      const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
      await ready(page);
      await page.evaluate(() => {
        const s = (window as any).__PHASER_GAME__.scene.getScene('WorldScene');
        s.sim.timeScale = 0; s.sim.player.pos = { x: 22.5, y: 7.5 };
      });
      for (const kind of gags) {
        await page.evaluate(kind => {
          const s = (window as any).__PHASER_GAME__.scene.getScene('WorldScene'), r = s.sim.run;
          r.hazards = []; r.hit = r.down = null;
          r.add(kind, { x: 24, y: 8, warnMs: 1000 });
          const h = r.hazards[0]; h.phase = 'active'; h.ms = h.activeMs * 0.35; h.t = 0.35; h.dx = 1;
        }, kind);
        await page.waitForTimeout(70);
        expect(await page.evaluate(() => {
          const view = (window as any).__PHASER_GAME__.scene.getScene('WorldScene').runView;
          // Painted art (a sprite) or the code-drawn fallback (graphics commands).
          return [...view.bodies.values()].some((g: any) => g.visible && g.commandBuffer.length > 0)
            || [...view.sprites.values()].some((i: any) => i.visible && i.alpha > 0);
        }), kind).toBe(true);
        await page.screenshot({ path: info.outputPath(`gag-${kind}.png`) });
      }
      expect(errors).toEqual([]);
    });

    test('the former cafe doorway stays on the street and no interior scene is loaded', async ({ page }) => {
      await ready(page);
      await page.evaluate(() => {
        const s = (window as any).__PHASER_GAME__.scene.getScene('WorldScene');
        s.sim.run.config.unlockSec = {}; s.sim.player.pos = { x: 29, y: 5.1 }; s.sim.startRun();
      });
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => Object.keys((window as any).__PHASER_GAME__.scene.keys))).not.toContain('ShopScene');
      expect(await page.evaluate(() => window.__TCSS__!.snapshot().story.street)).not.toHaveProperty('shop');
    });
  });
}
