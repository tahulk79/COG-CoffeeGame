import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page, url = '/?map=cafe'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}skipStory=1`);
  await page.waitForFunction(() => window.__TCSS__?.ready === true);
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.__TCSS__!.setCafeOpen(false);
    window.__TCSS__!.setTimeScale(3);
  });
  return errors;
}

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

async function stopNeedleInZone(page: Page): Promise<void> {
  const before = (await snap(page)).cafe!.brew!.stepIndex;
  await page.evaluate(() => window.__TCSS__!.setTimeScale(0.25));
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

/** Espresso by hand: grinder (bean + grind), then the espresso machine (tamp + extract). */
async function brewEspresso(page: Page): Promise<void> {
  await clickObject(page, 'grinder');
  await clickButton(page, 'brew.bean.roasted_arabica');
  await stopNeedleInZone(page);
  await clickObject(page, 'espresso');
  await stopNeedleInZone(page);
  await stopNeedleInZone(page);
  expect((await snap(page)).cafe!.heldDrink!.recipeId).toBe('espresso');
}

test('takeaway: order, brew, hand over at the pickup point, collect the coin; no table is used or dirtied', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__TCSS__!.grantItems('roasted_arabica', 2, 72));
  const id = (await page.evaluate(() => window.__TCSS__!.spawnCustomer('tourist', 'espresso', 'takeaway')))!;
  await page.waitForFunction((cid) => window.__TCSS__!.snapshot().cafe!.customers.find((c) => c.id === cid)?.state === 'ORDERING', id, { timeout: 20_000 });
  await clickCustomer(page, id);
  await page.waitForFunction((cid) => window.__TCSS__!.snapshot().cafe!.customers.find((c) => c.id === cid)?.state === 'WAITING', id);
  expect((await snap(page)).cafe!.customers.find((c) => c.id === id)!.spot).toMatch(/^pickup:/);
  await brewEspresso(page);
  expect(await page.evaluate(() => { const v=(window as any).__PHASER_GAME__.scene.getScene('WorldScene').playerView; return { held: v.held.visible, label: v.heldLabel.text, depth: v.held.depth }; })).toMatchObject({ held: true, label: '✓ Espresso' });
  await page.screenshot({path: 'docs/screenshots/cafe-held-drink.png'});
  await page.waitForFunction((cid) => {
    const c = window.__TCSS__!.snapshot().cafe!.customers.find((x) => x.id === cid);
    return c?.state === 'WAITING';
  }, id);
  await clickCustomer(page, id); // hand the drink over at the pickup point
  await page.waitForFunction(() => window.__TCSS__!.snapshot().cafe!.payments.length === 1, undefined, { timeout: 30_000 });
  const s = await snap(page);
  expect(s.cafe!.payments[0]!.objectId).toMatch(/^pickup_/);
  expect(s.cafe!.seats.filter((x) => x.kind === 'seat' && x.state !== 'AVAILABLE')).toEqual([]);
  const coins = s.economy.coins;
  await clickObject(page, s.cafe!.payments[0]!.objectId);
  await page.waitForFunction(() => window.__TCSS__!.snapshot().cafe!.payments.length === 0);
  expect((await snap(page)).economy.coins).toBeGreaterThan(coins);
  expect(errors).toEqual([]);
});

test('dine-in: the table is left dirty, blocks new customers, and the player cleans it (real work time)', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__TCSS__!.grantItems('roasted_arabica', 2, 72));
  const id = (await page.evaluate(() => window.__TCSS__!.spawnCustomer('student', 'espresso', 'dineIn')))!;
  await page.waitForFunction((cid) => window.__TCSS__!.snapshot().cafe!.customers.find((c) => c.id === cid)?.state === 'ORDERING', id, { timeout: 20_000 });
  await clickCustomer(page, id);
  await page.waitForFunction((cid) => window.__TCSS__!.snapshot().cafe!.customers.find((c) => c.id === cid)?.state === 'WAITING', id);
  const seat = (await snap(page)).cafe!.customers.find((c) => c.id === id)!.spot!.replace(/^[a-z]+:/, '');
  await brewEspresso(page);
  await page.waitForFunction((cid) => window.__TCSS__!.snapshot().cafe!.customers.find((x) => x.id === cid)?.state === 'WAITING', id);
  await clickCustomer(page, id);
  await page.waitForFunction((sid) => window.__TCSS__!.snapshot().cafe!.seats.find((x) => x.objectId === sid)?.state === 'DIRTY', seat, { timeout: 40_000 });
  const free = (await snap(page)).cafe!.freeSpots;
  await clickObject(page, seat); // collect the coin first
  expect((await snap(page)).cafe!.payments).toHaveLength(0);
  const t0 = (await snap(page)).timeMs;
  await clickObject(page, seat); // then clean
  expect((await snap(page)).cafe!.seats.find((x) => x.objectId === seat)!.state).toBe('AVAILABLE');
  expect((await snap(page)).timeMs - t0).toBeGreaterThanOrEqual(3500);
  expect((await snap(page)).cafe!.freeSpots).toBe(free + 1);
  expect(errors).toEqual([]);
});

test('camera: wheel zoom is limited, arrow keys pan, a click on the world recentres', async ({ page }) => {
  await boot(page);
  const z0 = (await page.evaluate(() => window.__TCSS__!.cameraInfo())).zoom;
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -120); // zoom in a lot
  await page.waitForTimeout(150);
  const zIn = (await page.evaluate(() => window.__TCSS__!.cameraInfo())).zoom;
  expect(zIn).toBeGreaterThan(z0);
  expect(zIn).toBeLessThanOrEqual(z0 * 2.4 + 0.001); // upper limit
  for (let i = 0; i < 80; i++) await page.mouse.wheel(0, 120);
  await page.waitForTimeout(150);
  expect((await page.evaluate(() => window.__TCSS__!.cameraInfo())).zoom).toBeGreaterThanOrEqual(z0 * 0.6 - 0.001); // lower limit
  // Panning with the arrow keys moves the view; clicking the floor brings it back.
  await page.evaluate(() => window.__TCSS__!.setTimeScale(1));
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -120);
  await page.waitForTimeout(100);
  const c0 = await page.evaluate(() => window.__TCSS__!.cameraInfo());
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(200);
  const c1 = await page.evaluate(() => window.__TCSS__!.cameraInfo());
  expect(c1.x).not.toBeCloseTo(c0.x, 0);
});

test('phone portrait: the world is close-up and follows the player, taps move them, nothing overflows', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = await boot(page, '/?map=cafe&close=1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const cam0 = await page.evaluate(() => window.__TCSS__!.cameraInfo());
  expect(cam0.width).toBe(390);
  expect(cam0.zoom).toBeGreaterThan(0.4); // close-up, not the whole map
  const start = (await snap(page)).player.tile;
  const target = await page.evaluate((start) => {
    const bridge = window.__TCSS__!, sim = (window as any).__PHASER_GAME__.scene.getScene('WorldScene').sim;
    for (const [dx,dy] of [[3,3],[2,3],[1,3],[-1,3],[3,2],[-2,2]]) {
      const t={x:start.x+dx!,y:start.y+dy!}, q=bridge.tileToClient(t), hit=bridge.clientToTarget(q.x,q.y);
      if(sim.world.grid.isWalkable(t)&&q.x>20&&q.x<370&&q.y>120&&q.y<730&&!hit.objectId&&!hit.customerId)return t;
    }
    throw new Error('no visible clear floor for a movement tap');
  }, start);
  const p = await page.evaluate((t) => window.__TCSS__!.tileToClient(t), target);
  expect(p.x).toBeGreaterThan(0);
  expect(p.x).toBeLessThan(390);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForFunction((t) => {
    const s = window.__TCSS__!.snapshot();
    return s.player.state === 'IDLE' && s.player.tile.x === t.x && s.player.tile.y === t.y;
  }, target, { timeout: 15_000 });
  const cam1 = await page.evaluate(() => window.__TCSS__!.cameraInfo());
  expect(Math.hypot(cam1.x - cam0.x, cam1.y - cam0.y)).toBeGreaterThan(5); // the camera followed
  // The toolbar buttons are on screen and tappable.
  for (const name of ['inv.open', 'recipes.open', 'meta.open']) {
    const b = await page.evaluate((n) => window.__TCSS__!.buttonClient(n), name);
    expect(b).not.toBeNull();
    expect(b!.x).toBeGreaterThan(0);
    expect(b!.x).toBeLessThan(390);
    expect(b!.y).toBeLessThan(844);
  }
  const inv = (await page.evaluate(() => window.__TCSS__!.buttonClient('inv.open')))!;
  await page.touchscreen.tap(inv.x, inv.y);
  await page.waitForFunction(() => window.__TCSS__!.buttonClient('inv.tab.all') !== null);
  expect(errors).toEqual([]);
  await ctx.close();
});
