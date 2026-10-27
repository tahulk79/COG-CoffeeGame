import { expect, test, type Page } from '@playwright/test';

const snap = (page: Page) => page.evaluate(() => window.__TCSS__!.snapshot());

async function idle(page: Page): Promise<void> {
  await page.waitForTimeout(120);
  await page.waitForFunction(() => {
    const s = window.__TCSS__!.snapshot();
    return !s.interaction.current && s.interaction.queue.length === 0 && ['IDLE', 'CARRYING'].includes(s.player.state);
  });
}

async function clickObject(page: Page, id: string): Promise<void> {
  const p = await page.evaluate((i) => window.__TCSS__!.objectClickClient(i), id);
  await page.mouse.click(p!.x, p!.y);
  await idle(page);
}

async function clickCustomer(page: Page, id: string): Promise<void> {
  const p = await page.evaluate((i) => window.__TCSS__!.customerClickClient(i), id);
  if (!p) throw new Error(`customer ${id} not on screen`);
  await page.mouse.click(p.x, p.y);
  await idle(page);
}

async function clickButton(page: Page, name: string): Promise<void> {
  await page.waitForFunction((n) => window.__TCSS__!.buttonClient(n)?.enabled === true, name, { timeout: 5000 });
  const b = (await page.evaluate((n) => window.__TCSS__!.buttonClient(n), name))!;
  await page.mouse.click(b.x, b.y);
}

/** Watch the needle like a player and hit Space while it is inside the green zone. */
async function stopNeedleInZone(page: Page): Promise<void> {
  const before = (await snap(page)).cafe!.brew!.stepIndex;
  await page.evaluate(() => window.__TCSS__!.setTimeScale(0.25)); // slow needle: reliable timing in a browser
  await page.waitForFunction(() => {
    const b = window.__TCSS__!.snapshot().cafe!.brew;
    const st = b?.current;
    if (!b || !st || st.kind !== 'timing' || b.needle === null) return false;
    return Math.abs(b.needle - st.target) < st.tolerance * 0.5;
  }, undefined, { timeout: 15_000, polling: 'raf' });
  await page.keyboard.press('Space');
  await page.waitForFunction((i) => {
    const s = window.__TCSS__!.snapshot().cafe!;
    return !s.brew || s.brew.stepIndex > i;
  }, before);
  await page.evaluate(() => window.__TCSS__!.setTimeScale(3));
}


for (const testMode of [false, true]) test(`story master${testMode ? ' (level 99 test mode)' : ''}: the lesson never stalls — order, brew espresso, serve, outro, then the farm`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?map=cafe&fresh=1');
  await page.waitForFunction(() => window.__TCSS__?.ready === true);
  await page.evaluate((tm) => {
    const sim = (window as any).__PHASER_GAME__.scene.getScene('WorldScene').sim;
    if (tm) sim.enableTestMode();
    sim.state.story = { chapter: 'S05', flags: {} };
    window.__TCSS__!.saveNow();
  }, testMode);
  await page.goto('/?map=master');
  await page.waitForFunction(() => window.__TCSS__?.ready === true && window.__TCSS__.snapshot().story.dialog !== null);
  expect((await snap(page)).map).toBe('master');
  // Menu is on screen, but the map and the notebook (hidden during the story) are not offered.
  await page.waitForFunction(() => window.__TCSS__!.buttonClient('inv.open') === null);
  for (let i = 0; i < 3; i++) await clickButton(page, 'story.next');
  await page.evaluate(() => window.__TCSS__!.setTimeScale(3));
  await page.waitForFunction(() => window.__TCSS__!.buttonClient('inv.open') !== null);
  expect(await page.evaluate(() => window.__TCSS__!.buttonClient('world.open'))).toBeNull();
  expect(await page.evaluate(() => window.__TCSS__!.buttonClient('meta.open'))).toBeNull();
  expect(await page.evaluate(() => window.__TCSS__!.buttonClient('toolbar.travel'))).toBeNull();

  const id = await page.waitForFunction(() => window.__TCSS__!.snapshot().cafe!.customers.find((c) => c.archetype === 'master' && c.state === 'ORDERING')?.id, undefined, { timeout: 20_000 }).then((h) => h.jsonValue() as Promise<string>);
  await clickCustomer(page, id);
  await page.waitForFunction((cid) => window.__TCSS__!.snapshot().cafe!.customers.find((c) => c.id === cid)?.state === 'WAITING', id);
  await clickObject(page, 'grinder');
  await clickButton(page, 'brew.bean.roasted_arabica');
  await stopNeedleInZone(page);
  await clickObject(page, 'espresso');
  await stopNeedleInZone(page);
  await stopNeedleInZone(page);
  expect((await snap(page)).cafe!.heldDrink?.recipeId).toBe('espresso');
  await clickCustomer(page, id);
  // Rated → outro dialog → travel to the farm.
  await page.waitForFunction(() => window.__TCSS__!.snapshot().story.dialog !== null, undefined, { timeout: 40_000 });
  for (let i = 0; i < 3; i++) await clickButton(page, 'story.next');
  await page.waitForFunction(() => window.__TCSS__!.snapshot().map === 'farm', undefined, { timeout: 20_000 });
  expect((await snap(page)).story.chapter).toBe('done');
  expect(errors).toEqual([]);
});
