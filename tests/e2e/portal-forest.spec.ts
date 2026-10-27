import { expect, test, type Page } from '@playwright/test';
import { createNewGameState } from '../../src/gameplay/state/GameState';
const views=[{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:1024,height:768},{width:1440,height:900},{width:1920,height:1080}];
async function button(page:Page,name:string){await page.waitForFunction(n=>window.__TCSS__?.buttonClient(n)?.enabled,name);const q=await page.evaluate(n=>window.__TCSS__!.buttonClient(n)!,name);await page.mouse.click(q.x,q.y);await page.waitForTimeout(120);}
async function object(page:Page,id:string){
  const size=page.viewportSize()!;
  for(let i=0;i<35;i++){
    const q=await page.evaluate(id=>window.__TCSS__!.objectClickClient(id)!,id);
    const top=size.height>size.width?150:110;
    if(q.x>25&&q.x<size.width-25&&q.y>top&&q.y<size.height-35){
      expect(await page.evaluate(q=>window.__TCSS__!.clientToTarget(q.x,q.y).objectId,q)).toBe(id);
      await page.mouse.click(q.x,q.y);return;
    }
    const keys:string[]=[];
    if(q.x<25)keys.push('ArrowLeft');else if(q.x>size.width-25)keys.push('ArrowRight');
    if(q.y<top)keys.push('ArrowUp');else if(q.y>size.height-35)keys.push('ArrowDown');
    for(const k of keys)await page.keyboard.down(k);
    await page.waitForTimeout(200);
    for(const k of keys)await page.keyboard.up(k);
  }
  throw new Error(`could not frame ${id}`);
}
for(const viewport of views)test(`forest gameplay, save/load and viewport ${viewport.width}`,async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize(viewport);
  const state=createNewGameState({now:Date.now(),startingCoins:200,startingItems:{},wateringCanCapacity:4,map:'portal'});
  state.story={chapter:'S04',flags:{}};
  await page.addInitScript(state=>{if(!localStorage.getItem('tcss.save.slot1'))localStorage.setItem('tcss.save.slot1',JSON.stringify(state));},state);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?story=1&close=1');await page.waitForFunction(()=>window.__TCSS__?.ready);
  await button(page,'story.next');await button(page,'story.next');
  await page.evaluate(()=>window.__TCSS__!.setTimeScale(2));
  expect(await page.evaluate(()=>{const r=document.querySelector('canvas')!.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y};})).toEqual({w:viewport.width,h:viewport.height,x:0,y:0});
  await page.screenshot({path:`docs/screenshots/portal-forest-${viewport.width}.png`,scale:'css'});
  const pacing=await page.evaluate(()=>new Promise<{averageMs:number;p95Ms:number}>(resolve=>{const times:number[]=[];let last=performance.now();const sample=(now:number)=>{times.push(now-last);last=now;if(times.length<40)requestAnimationFrame(sample);else{const sorted=times.slice(4).sort((a,b)=>a-b);resolve({averageMs:sorted.reduce((a,b)=>a+b,0)/sorted.length,p95Ms:sorted[Math.floor(sorted.length*.95)]!});}};requestAnimationFrame(sample);}));
  console.log('FOREST_FRAME_PACING',viewport.width,JSON.stringify(pacing));
  await test.info().attach('frame-pacing',{body:JSON.stringify({viewport,pacing}),contentType:'application/json'});
  for(const[id,index]of [['stone_touch',1],['stone_sight',2],['stone_hearing',3]] as const){
    await object(page,id);
    await page.waitForFunction(id=>window.__TCSS__!.snapshot().story.stones[id]===true,id);
    expect(await page.evaluate(()=>Object.values(window.__TCSS__!.snapshot().story.stones).filter(Boolean).length)).toBe(index);
    if(index===1){await page.evaluate(()=>window.__TCSS__!.saveNow());await page.reload();await page.waitForFunction(()=>window.__TCSS__?.ready);expect(await page.evaluate(()=>window.__TCSS__!.snapshot().story.stones.stone_touch)).toBe(true);await page.evaluate(()=>window.__TCSS__!.setTimeScale(2));}
  }
  expect(await page.evaluate(()=>window.__TCSS__!.snapshot().story.chapter)).toBe('S04');
  expect(await page.evaluate(()=>window.__TCSS__!.snapshot().story.portalOpen)).toBe(true);
  await object(page,'portal');
  await page.waitForFunction(()=>window.__TCSS__!.snapshot().story.dialog!==null);
  await page.screenshot({path:`docs/screenshots/portal-open-${viewport.width}.png`,scale:'css'});
  await button(page,'story.next');await page.waitForFunction(()=>window.__TCSS__?.snapshot().map==='master');
  expect(await page.evaluate(()=>window.__TCSS__!.buttonClient('world.open'))).toBeNull();
  expect(errors).toEqual([]);
});
