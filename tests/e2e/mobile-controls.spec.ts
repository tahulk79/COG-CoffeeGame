import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test.describe(`street touch controls ${viewport.width}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });
    test('arrival stays still, pan does not steer, joystick moves, both medics appear', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('/?fresh=1&story=1&close=1');
      await page.waitForFunction(() => window.__TCSS__?.ready);
      const initial = await page.evaluate(() => window.__TCSS__!.snapshot().player.pos);
      await page.waitForTimeout(1800);
      expect(await page.evaluate(() => window.__TCSS__!.snapshot().player.pos)).toEqual(initial);
      expect(await page.evaluate(() => (window as any).__PHASER_GAME__.scene.getScene('HudScene').storyHud.top.visible)).toBe(false);
      const camera = await page.evaluate(() => window.__TCSS__!.cameraInfo());
      const cdp = await page.context().newCDPSession(page);
      const start = { x: 160, y: viewport.height / 2 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + i * 10, y: start.y + i * 4, id: 1 }] });
        await page.waitForTimeout(25);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(350);
      expect(await page.evaluate(() => window.__TCSS__!.snapshot().player.pos)).toEqual(initial);
      const panned = await page.evaluate(() => window.__TCSS__!.cameraInfo());
      expect(Math.abs(panned.x - camera.x)).toBeGreaterThan(50);
      await page.waitForTimeout(300);
      expect((await page.evaluate(() => window.__TCSS__!.cameraInfo())).x).toBeCloseTo(panned.x, 0);
      const y = viewport.height - 90;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 82, y, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y, id: 1 }] });
      await page.waitForTimeout(250);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      expect(await page.evaluate(() => window.__TCSS__!.snapshot().player.pos)).not.toEqual(initial);
      await page.evaluate(() => {
        const s = (window as any).__PHASER_GAME__.scene.getScene('WorldScene');
        s.sim.player.pos = { x: 2.5, y: 7.5 };
        s.sim.run.crash('motorbike', 'Ối…', 2000);
        s.sim.timeScale = 4;
      });
      await page.waitForFunction(() => window.__TCSS__!.snapshot().story.street?.carried, undefined, { timeout: 20000 });
      const medics = await page.evaluate(() => {
        const s = (window as any).__PHASER_GAME__.scene.getScene('WorldScene');
        return ['medic0', 'medic1'].map(id => ({ visible: s.streetView.bodies.get(id)?.visible, texture: s.streetView.bodies.get(id)?.texture.key }));
      });
      expect(medics).toEqual([{ visible: true, texture: 'npc:medic' }, { visible: true, texture: 'npc:medic' }]);
      await page.screenshot({ path: `/tmp/coffee-rescue-${viewport.width}.png` });
      expect(errors).toEqual([]);
    });

    for (const gate of [{ id: 'west', x: 2.2 }, { id: 'east', x: 45.8 }]) {
      test(`arguing at ${gate.id} carries the hero before travelling to chapter 2`, async ({ page }, info) => {
        await page.goto('/?fresh=1&story=1&close=1');
        await page.waitForFunction(() => window.__TCSS__?.ready);
        await page.waitForFunction(() => !(window as any).__PHASER_GAME__.scene.isActive('TransitionScene'));
        await page.evaluate(x => {
          const game = (window as any).__PHASER_GAME__;
          const s = game.scene.getScene('WorldScene');
          s.sim.run.config.unlockSec = {};
          const npcs = s.sim.street.npcs;
          for (let i = npcs.length - 1; i >= 0; i--) if (npcs[i].bike) npcs.splice(i, 1);
          s.sim.player.pos = { x, y: 9.5 };
          s.sim.startRun();
          s.sim.timeScale = 4;
          const proof = { carried: false, bonked: false, loaded: false, badGround: false, missingMedic: false, vanInFrame: false, groundSeen: false, floating: false };
          (window as any).__rescueProof = proof;
          s.events.on('postupdate', () => {
            if (!s.scene.isActive()) return;
            const st = s.sim.street?.view();
            if (!st) return;
            proof.carried ||= st.carried;
            proof.bonked ||= !!st.bonk;
            proof.loaded ||= st.heroHidden;
            const down = s.sim.run?.view().down;
            if (down && down.t > 0.12 && !st.carried && !st.heroHidden) {
              proof.groundSeen = true;
              proof.floating ||= s.playerView.img.depth > 100000;
            }
            if (st.heroDown && !st.heroHidden) proof.badGround ||= !s.sim.world.grid.isWalkable(s.sim.player.tile);
            if (st.carried) {
              proof.missingMedic ||= ['medic0', 'medic1'].some(id => !s.streetView.bodies.get(id)?.visible);
              const van = st.npcs.find((n: any) => n.look === 'ambulance');
              if (van) {
                const at = s.renderToCanvas((van.x - van.y) * 64, (van.x + van.y) * 32);
                proof.vanInFrame ||= at.x >= 0 && at.x <= s.scale.width && at.y >= 0 && at.y <= s.scale.height;
              }
            }
          });
        }, gate.x);
        await page.waitForFunction(() => window.__TCSS__!.buttonClient('story.choice.0')?.enabled);
        const button = await page.evaluate(() => window.__TCSS__!.buttonClient('story.choice.0')!);
        await page.touchscreen.tap(button.x, button.y);
        await page.waitForFunction(() => { const r = window.__TCSS__?.snapshot().story.run; return r?.down && r.down.t > 0.3; });
        await page.evaluate(() => window.__TCSS__!.setTimeScale(0));
        await page.screenshot({ path: info.outputPath(`ground-${gate.id}.png`) });
        await page.evaluate(() => window.__TCSS__!.setTimeScale(4));
        await page.waitForFunction(() => window.__TCSS__!.snapshot().map === 'portal', undefined, { timeout: 20000 });
        expect(await page.evaluate(() => (window as any).__rescueProof)).toEqual({ carried: true, bonked: true, loaded: true, badGround: false, missingMedic: false, vanInFrame: true, groundSeen: true, floating: false });
      });
    }

    test('courtyard rescue enters from the street through the alley and carries the hero back out', async ({ page }) => {
      await page.goto('/?fresh=1&story=1&close=1');
      await page.waitForFunction(() => window.__TCSS__?.ready);
      await page.waitForFunction(() => !(window as any).__PHASER_GAME__.scene.isActive('TransitionScene'));
      await page.evaluate(() => {
        const s = (window as any).__PHASER_GAME__.scene.getScene('WorldScene');
        const proof = { droveIntoAlley: false, vanInFrame: false, doctorsVisible: false, bonked: false, loaded: false };
        (window as any).__alleyProof = proof;
        s.sim.player.pos = { x: 25.7, y: 1.2 };
        s.sim.startRun(); s.sim.run.crash('durian', 'Ối…', 2000); s.sim.timeScale = 4;
        s.events.on('postupdate', () => {
          const st = s.sim.street?.view();
          if (!st) return;
          const van = st.npcs.find((n: any) => n.look === 'ambulance');
          proof.droveIntoAlley ||= !!van && van.y < 5 && van.axis === 'y';
          proof.bonked ||= !!st.bonk; proof.loaded ||= st.heroHidden;
          if (van && st.carried) {
            const at = s.renderToCanvas((van.x - van.y) * 64, (van.x + van.y) * 32);
            proof.vanInFrame ||= at.x >= 0 && at.x <= s.scale.width && at.y >= 0 && at.y <= s.scale.height;
            proof.doctorsVisible ||= ['medic0', 'medic1'].every(id => s.streetView.bodies.get(id)?.visible);
          }
        });
      });
      await page.waitForFunction(() => window.__TCSS__?.snapshot().story.street?.carried, undefined, { timeout: 20000 });
      await page.evaluate(() => window.__TCSS__!.setTimeScale(0));
      await page.screenshot({ path: `/tmp/coffee-alley-rescue-${viewport.width}.png` });
      await page.evaluate(() => window.__TCSS__!.setTimeScale(4));
      await page.waitForFunction(() => window.__TCSS__?.snapshot().map === 'portal', undefined, { timeout: 20000 });
      expect(await page.evaluate(() => (window as any).__alleyProof)).toEqual({ droveIntoAlley: true, vanInFrame: true, doctorsVisible: true, bonked: true, loaded: true });
    });
  });
}

test('desktop opens with a wider view; dragging pans and a plain click still walks', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?fresh=1&story=1&close=1');
  await page.waitForFunction(() => window.__TCSS__?.ready);
  const initial = await page.evaluate(() => window.__TCSS__!.snapshot().player.pos);
  expect((await page.evaluate(() => window.__TCSS__!.cameraInfo())).zoom).toBeLessThan(1);
  await page.mouse.move(700, 450);
  await page.mouse.down();
  await page.mouse.move(800, 480, { steps: 10 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__TCSS__!.snapshot().player.pos)).toEqual(initial);
  await page.screenshot({ path: '/tmp/coffee-camera-desktop.png' });
  await page.mouse.click(720, 560);
  await expect.poll(() => page.evaluate(() => window.__TCSS__!.snapshot().player.pos)).not.toEqual(initial);
});
