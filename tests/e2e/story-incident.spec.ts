import { expect, test, type Page } from '@playwright/test';

async function press(page: Page, name: string) {
  await page.waitForFunction((n) => window.__TCSS__?.buttonClient(n)?.enabled, name);
  const b=await page.evaluate((n)=>window.__TCSS__!.buttonClient(n)!,name);
  expect(b.x).toBeGreaterThan(0); expect(b.x).toBeLessThan((await page.viewportSize())!.width);
  expect(b.y).toBeGreaterThan(0); expect(b.y).toBeLessThan((await page.viewportSize())!.height);
  if(await page.evaluate(()=>navigator.maxTouchPoints>0)) await page.touchscreen.tap(b.x,b.y);
  else await page.mouse.click(b.x,b.y);
  await page.waitForTimeout(120);
}
for (const viewport of [{width:1440,height:900},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:1024,height:768},{width:1920,height:1080}]) {
  test.describe(`incident ${viewport.width}`,()=>{
    test.use({viewport,hasTouch:viewport.width<900,isMobile:viewport.width<900});
    test('dialog actions, rescue navigation, transition and labels',async({page})=>{
      const errors:string[]=[]; page.on('pageerror',(e)=>errors.push(e.message));
      await page.goto('/?fresh=1&close=1&story=1');
      await page.waitForFunction(()=>window.__TCSS__?.ready);
      expect(await page.evaluate(()=>window.__TCSS__!.snapshot().story.chapter)).toBe('S03');
      await page.evaluate(() => {
        const g=(window as any).__PHASER_GAME__;
        (window as any).__badToolbarFrames=[];
        g.events.on('poststep',()=>{
          const s=window.__TCSS__!.snapshot(), hud=g.scene.getScene('HudScene');
          if(!['cafe','farm'].includes(s.map) && hud.toolbar?.root.visible) (window as any).__badToolbarFrames.push(s.map);
        });
      });
      expect(await page.evaluate(()=>{const r=document.querySelector('canvas')!.getBoundingClientRect();return {width:r.width,height:r.height};})).toEqual(viewport);
      await page.screenshot({path:`docs/screenshots/incident-intro-${viewport.width}.png`});
      await press(page,'story.next'); await press(page,'story.next');
      await page.waitForFunction(()=>window.__TCSS__!.snapshot().story.dialog===null);
      const labels=await page.evaluate(()=>{
        const scene=(window as any).__PHASER_GAME__.scene.getScene('WorldScene');
        return [...scene.worldRenderer.objectGfx.values()].map((e:any)=>({id:e.data.id,visible:e.label.visible,text:e.label.text}));
      });
      expect(labels.find((x)=>x.id==='kitten')).toMatchObject({text:'Chú mèo con'});
      expect(labels.filter((x)=>x.visible).length).toBeLessThan(labels.length);
      expect(await page.evaluate(()=>window.__TCSS__!.buttonClient('world.open'))).toBeNull();
      await page.screenshot({path:`docs/screenshots/incident-gameplay-${viewport.width}.png`});
      if (viewport.width === 1440) {
        const p = await page.evaluate(() => window.__TCSS__!.objectClickClient('kitten')!);
        expect(await page.evaluate((p) => window.__TCSS__!.clientToTarget(p.x, p.y).objectId, p)).toBe('kitten');
        await page.mouse.click(p.x, p.y);
      } else await press(page,'story.rescue');
      await page.waitForFunction(()=>window.__TCSS__!.snapshot().story.dialog!==null,undefined,{timeout:20000});
      const events=await page.evaluate(()=>window.__TCSS__!.events());
      expect(events.some((e)=>e.type==='interaction:completed'&&(e.payload as any).actionId==='rescue')).toBe(true);
      await page.screenshot({path:`docs/screenshots/incident-rescued-${viewport.width}.png`});
      await press(page,'story.next'); await press(page,'story.next');
      await page.waitForFunction(()=>window.__TCSS__?.snapshot().map==='portal');
      expect(await page.evaluate(()=>(window as any).__badToolbarFrames)).toEqual([]);
      expect(await page.evaluate(()=>(window as any).__PHASER_GAME__.scene.getScene('WorldScene').cameras.main.flashEffect.isRunning)).toBe(false);
      expect(errors).toEqual([]);
    });
  });
}
