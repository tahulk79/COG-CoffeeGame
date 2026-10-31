import { STREET_CAMERA_AREA } from '../../src/data/streetSceneLayout';
import { screenToWorld } from '../../src/utils/iso';
import { test, expect, type Page } from '@playwright/test';
import type { TestBridge } from '../../src/core/testBridge';

declare global { interface Window { __TCSS__?: TestBridge } }
async function ready(page: Page) {
  await page.waitForFunction(() => window.__TCSS__?.ready);
  await expect.poll(() => page.evaluate(() => window.__TCSS__!.buttonClient('settings.open') !== null)).toBe(true);
  // Let loading doors finish opening before exercising actual canvas inputs.
  await page.waitForTimeout(1200);
}
async function button(page: Page, name: string) {
  // Simulation changes precede the HUD's next rendered frame.
  await expect.poll(() => page.evaluate(n => window.__TCSS__!.buttonClient(n)?.enabled ?? false, name), { timeout: 5000 }).toBe(true);
  const p = await page.evaluate(n => window.__TCSS__!.buttonClient(n), name);
  expect(p, name).not.toBeNull(); expect(p!.enabled).toBe(true);
  await page.mouse.click(p!.x, p!.y);
}
test('canvas movement, pointer mapping, settings pause and debug grid', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?chap=1&debugMap=1'); await ready(page);
  // The detail tiles stream in after the street is playable.
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('/assets/slice/chapter1/hd/')).length), { timeout: 30000 }).toBe(7);
  const start = await page.evaluate(() => window.__TCSS__!.snapshot().player.pos);
  await page.keyboard.down('d'); await page.waitForTimeout(160); await page.keyboard.up('d');
  await expect.poll(async () => {
    const p = await page.evaluate(() => window.__TCSS__!.snapshot().player.pos);
    return Math.hypot(p.x - start.x, p.y - start.y);
  }).toBeGreaterThan(.15);
  // Read the real camera inverse: a screen tap must still select the projected tile after reframing.
  expect(await page.evaluate(() => {
    const b = window.__TCSS__!, tile = b.snapshot().player.tile, p = b.tileToClient(tile);
    return b.clientToTile(p.x, p.y);
  })).toEqual(await page.evaluate(() => window.__TCSS__!.snapshot().player.tile));
  await button(page, 'settings.open'); await page.waitForTimeout(200);
  const paused = await page.evaluate(() => window.__TCSS__!.snapshot());
  await page.keyboard.down('a'); await page.waitForTimeout(350); await page.keyboard.up('a');
  const after = await page.evaluate(() => window.__TCSS__!.snapshot());
  expect(after.player.pos).toEqual(paused.player.pos);
  expect(after.story.street!.elapsedMs).toBe(paused.story.street!.elapsedMs);
  await button(page, 'settings.close');
  await expect.poll(() => page.evaluate(() => window.__TCSS__!.buttonClient('settings.close'))).toBeNull();
  if (info.project.name === 'phone') {
    const p = await page.evaluate(() => window.__TCSS__!.tileToClient({ x: 25, y: 14 }));
    await page.touchscreen.tap(p.x, p.y);
  } else {
    const p = await page.evaluate(() => window.__TCSS__!.tileToClient({ x: 25, y: 14 }));
    await page.mouse.click(p.x, p.y);
  }
  await expect.poll(async () => {
    const p = await page.evaluate(() => window.__TCSS__!.snapshot().player.pos);
    return Math.hypot(p.x - 25.5, p.y - 14.5);
  // Someone standing on the tapped spot is fine: the hero stops within ARRIVE_NEAR (0.9 tile) of it.
  }, { timeout: 15000 }).toBeLessThan(.95);
  await page.screenshot({ path: `artifacts/chapter1-debug-${info.project.name}.png` });
  await page.keyboard.press('F2'); await page.waitForTimeout(100);
  await page.screenshot({ path: `artifacts/chapter1-city-hd-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
test('real crash, ambulance, portal, chapter 2 dialogue and answer', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?incidentReview=durian&close=1'); await ready(page);
  await page.getByRole('button', { name: 'Bắt đầu / tiếp tục' }).click();
  const exposed: string[] = [];
  await expect.poll(async () => {
    const frame = await page.evaluate(() => ({ s: window.__TCSS__!.snapshot(), c: window.__TCSS__!.cameraInfo() }));
    if (frame.s.map === 'incident') {
      const { c } = frame, a = STREET_CAMERA_AREA;
      for (const dx of [-c.width / c.zoom / 2, c.width / c.zoom / 2]) for (const dy of [-c.height / c.zoom / 2, c.height / c.zoom / 2]) {
        const p = screenToWorld({ x: c.x + dx, y: c.y + dy });
        if (p.x < a.left || p.x > a.right || p.y < a.top || p.y > a.bottom) exposed.push(JSON.stringify(p));
      }
    }
    return frame.s.story.chapter;
  }, { timeout: 120000, intervals: [100, 250, 500] }).toBe('S04');
  expect(exposed, 'Viewport corners exposed during ambulance follow').toEqual([]);
  await ready(page);
  await expect.poll(() => page.evaluate(() => window.__TCSS__!.snapshot().story.trial?.say?.name)).toBe('Thần Chết');
  for (let n = 0; n < 12; n++) {
    const v = await page.evaluate(() => window.__TCSS__!.snapshot().story.trial!);
    if (!v.say) break;
    await button(page, v.choices ? 'story.answer.0' : 'story.talk.next'); await page.waitForTimeout(80);
  }
  // The quest panel is the actual auto-walk control, on both responsive layouts.
  await page.mouse.click(100, 100);
  await expect.poll(() => page.evaluate(() => !!window.__TCSS__!.snapshot().story.trial?.say), { timeout: 15000 }).toBe(true);
  for (let n = 0; n < 40; n++) {
    const v = await page.evaluate(() => window.__TCSS__!.snapshot().story.trial!);
    if (v.choices) break;
    // The choices can appear between the read and the click, taking the button away: look again instead of failing.
    if (!(await page.evaluate(() => window.__TCSS__!.buttonClient('story.talk.next')?.enabled))) { await page.waitForTimeout(150); continue; }
    await button(page, 'story.talk.next'); await page.waitForTimeout(80);
  }
  expect(await page.evaluate(() => window.__TCSS__!.snapshot().story.trial!.choices)).toHaveLength(3);
  await button(page, 'story.answer.0');
  for (let n = 0; n < 12; n++) {
    const v = await page.evaluate(() => window.__TCSS__!.snapshot().story.trial!);
    if (v.lessons.length) break;
    await button(page, 'story.talk.next'); await page.waitForTimeout(80);
  }
  expect(await page.evaluate(() => window.__TCSS__!.snapshot().story.trial!.lessons)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('HD facade tiles retain native detail at the current camera zoom', async ({ page }, info) => {
  await page.goto('/?incidentReview=durian&close=1'); await ready(page);
  await page.waitForFunction(() => {
    const game = (window as unknown as { __PHASER_GAME__: { textures: { exists(key: string): boolean } } }).__PHASER_GAME__;
    return [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [2, 1], [2, 2]].every(([r, c]) => game.textures.exists(`slice.chapter1.detail.v1.${r}.${c}:feather`));
  }, undefined, { timeout: 30000 });
  const sizes = await page.evaluate(() => {
    const game = (window as unknown as { __PHASER_GAME__: { textures: { get(key: string): { getSourceImage(): { width: number; height: number } }; exists(key: string): boolean } } }).__PHASER_GAME__;
    return [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [2, 1], [2, 2]].map(([r, c]) => {
      const key = `slice.chapter1.detail.v1.${r}.${c}`, source = game.textures.get(`${key}:feather`).getSourceImage();
      return { w: source.width, h: source.height, rendered: !game.textures.exists(key) };
    });
  });
  for (const size of sizes) {
    expect(size.w).toBeGreaterThanOrEqual(1400); expect(size.h).toBeGreaterThanOrEqual(900); expect(size.rendered).toBe(true);
  }
  await page.screenshot({ path: `artifacts/chapter1-city-hd-north-${info.project.name}.png` });
});
