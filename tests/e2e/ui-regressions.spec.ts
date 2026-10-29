import { expect, test, type Page } from '@playwright/test';
async function click(page:Page,name:string) {
  await page.waitForFunction((n)=>window.__TCSS__?.buttonClient(n)?.enabled,name);
  const p=await page.evaluate((n)=>window.__TCSS__!.buttonClient(n)!,name);
  await page.mouse.click(p.x,p.y); await page.waitForTimeout(100);
}
for (const width of [1440,390]) test(`table upgrades and cafe/farm isolation ${width}`,async({page})=>{
  await page.setViewportSize({width,height:width===1440?900:844});
  await page.goto('/?map=farm&cheat=1&skipStory=1'); await page.waitForFunction(()=>window.__TCSS__?.ready);
  await click(page,'toolbar.travel');
  await page.waitForFunction(()=>window.__TCSS__?.snapshot().map==='cafe');
  expect(await page.evaluate(()=>window.__TCSS__!.snapshot().farm.plots)).toEqual([]);
  expect(await page.evaluate(()=>window.__TCSS__!.buttonClient('farm.panel'))).toBeNull();
  expect(await page.evaluate(()=>window.__TCSS__!.snapshot().progression.level)).toBeGreaterThanOrEqual(99);
  expect(await page.evaluate(()=>window.__TCSS__!.snapshot().economy.coins)).toBeGreaterThanOrEqual(999000000);
  await click(page,'tables.open');
  const t=await page.evaluate(()=>window.__TCSS__!.snapshot().tables[0]!);
  const coins=await page.evaluate(()=>window.__TCSS__!.snapshot().economy.coins);
  await click(page,`table.upgrade.${t.id}`);
  await expect.poll(()=>page.evaluate((id)=>window.__TCSS__!.snapshot().tables.find((x)=>x.id===id)!.level,t.id)).toBe(2);
  expect(await page.evaluate(()=>window.__TCSS__!.snapshot().economy.coins)).toBe(coins-150);
  await page.screenshot({path:`docs/screenshots/table-upgrade-${width}.png`});
  await page.evaluate(()=>window.__TCSS__!.saveNow());
  await page.goto('/?skipStory=1'); await page.waitForFunction(()=>window.__TCSS__?.ready);
  expect(await page.evaluate((id)=>window.__TCSS__!.snapshot().tables.find((x)=>x.id===id)!.level,t.id)).toBe(2);
});
