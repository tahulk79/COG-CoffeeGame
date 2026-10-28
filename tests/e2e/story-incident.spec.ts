import { expect, test, type Page } from '@playwright/test';

async function press(page: Page, name: string) {
  await page.waitForFunction(n => window.__TCSS__?.buttonClient(n)?.enabled, name);
  const p = await page.evaluate(n => window.__TCSS__!.buttonClient(n)!, name);
  const viewport = page.viewportSize()!;
  expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(viewport.width);
  expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(viewport.height);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(200);
}

async function rms(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const audio = (window as any).__PHASER_GAME__.scene.getScene('WorldScene').runAudio;
    const ctx: AudioContext = audio.ctx, analyser = ctx.createAnalyser(), silent = ctx.createGain();
    silent.gain.value = 0; analyser.fftSize = 1024;
    audio.out.connect(analyser); analyser.connect(silent); silent.connect(ctx.destination);
    const buffer = new Float32Array(analyser.fftSize);
    let peakRms = 0;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      analyser.getFloatTimeDomainData(buffer);
      peakRms = Math.max(peakRms, Math.sqrt(buffer.reduce((sum, v) => sum + v * v, 0) / buffer.length));
    }
    audio.out.disconnect(analyser); analyser.disconnect(); silent.disconnect();
    return peakRms;
  });
}

const viewports = [
  { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 },
  { width: 844, height: 390 }, { width: 1024, height: 768 }, { width: 1440, height: 900 },
];
for (const viewport of viewports) {
  test.describe(`prototype 1 UI ${viewport.width}`, () => {
    test.use({ viewport, hasTouch: viewport.width < 900, isMobile: viewport.width < 900 });
    test('boots still, fits settings, unlocks audio, persists mute, and pauses the run in settings', async ({ page }, info) => {
      const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('/?fresh=1&story=1&close=1');
      await page.waitForFunction(() => window.__TCSS__?.ready && !(window as any).__PHASER_GAME__.scene.isActive('TransitionScene'));
      const initial = await page.evaluate(() => window.__TCSS__!.snapshot().player.pos);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => window.__TCSS__!.snapshot().player.pos)).toEqual(initial);
      expect(await page.evaluate(() => {
        const hud = (window as any).__PHASER_GAME__.scene.getScene('HudScene');
        return { objective: hud.storyHud.top.visible, toolbar: hud.toolbar.root.visible, dialog: window.__TCSS__!.snapshot().story.dialog };
      })).toEqual({ objective: false, toolbar: false, dialog: null });
      expect(await page.evaluate(() => { const r = document.querySelector('canvas')!.getBoundingClientRect(); return { width: r.width, height: r.height }; })).toEqual(viewport);
      await page.screenshot({ path: info.outputPath('street.png') });
      await press(page, 'story.mute');
      expect(await page.evaluate(() => localStorage.getItem('tcss.audio.mute.v2'))).toBe('1');
      expect(await rms(page)).toBeLessThan(0.00001);
      await press(page, 'story.mute');
      expect(await page.evaluate(() => (window as any).__PHASER_GAME__.sound.context.state)).toBe('running');
      expect(await rms(page)).toBeGreaterThan(0.0001);
      await page.evaluate(() => {
        const s = (window as any).__PHASER_GAME__.scene.getScene('WorldScene');
        s.sim.run.config.unlockSec = {}; s.sim.player.pos = { x: 20, y: 15.5 }; s.sim.startRun();
      });
      await press(page, 'settings.open');
      for (const name of ['settings.close', 'settings.replay', 'settings.newGame', 'settings.lang.vi', 'settings.lang.en']) {
        const p = await page.evaluate(n => window.__TCSS__!.buttonClient(n), name);
        expect(p, name).not.toBeNull();
        expect(p!.x, name).toBeGreaterThan(0); expect(p!.x, name).toBeLessThan(viewport.width);
        expect(p!.y, name).toBeGreaterThan(0); expect(p!.y, name).toBeLessThan(viewport.height);
      }
      await page.screenshot({ path: info.outputPath('settings.png') });
      const time = await page.evaluate(() => window.__TCSS__!.snapshot().story.run!.aliveMs);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => window.__TCSS__!.snapshot().story.run!.aliveMs)).toBe(time);
      await press(page, 'settings.close');
      await expect.poll(() => page.evaluate(() => window.__TCSS__!.snapshot().story.run!.aliveMs)).toBeGreaterThan(time);
      await press(page, 'story.mute');
      await page.reload();
      await page.waitForFunction(() => window.__TCSS__?.ready);
      expect(await page.evaluate(() => (window as any).__PHASER_GAME__.sound.mute)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}
