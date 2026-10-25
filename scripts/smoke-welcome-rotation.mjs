import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {welcomeScenes} from '../src/cafe-welcome.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const body=await fs.readFile(new URL('../docs/index.html',import.meta.url),'utf8');
try{for(const [width,height,lang]of [[320,568,'vi'],[390,844,'en'],[844,390,'vi']]){
 const p=await b.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(lang=>{if(!localStorage.getItem('c6s.language'))localStorage.setItem('c6s.language',lang);},lang);await p.route('https://coffee.test/',r=>r.fulfill({body,contentType:'text/html'}));await p.addInitScript(()=>{if(window.top===window)localStorage.setItem('c6s.rebirth.mode','classic');});await p.goto('https://coffee.test/');const ids=[];
 async function fit(){assert.ok(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1),'document overflows');for(const sel of ['.welcome-cup','.welcome-cat','#season-welcome-pour']){const r=await p.locator(sel).boundingBox();assert.ok(r&&r.width>=44&&r.height>=44&&r.y>=0&&r.y+r.height<=height&&r.x>=0&&r.x+r.width<=width,`${sel} clipped`);}}
 for(let i=0;i<14;i++){
  const id=await p.locator('.welcome-stage').getAttribute('data-welcome-scene');assert.equal(id,welcomeScenes[i].id);ids.push(id);await fit();await p.reload();assert.equal(await p.locator('.welcome-stage').getAttribute('data-welcome-scene'),id);
  for(const sel of ['.welcome-cup','[data-welcome-choice=tap]','.welcome-cat']){await p.locator(sel).click();await fit();}
  await p.locator('#season-enter').click();assert.equal(await p.locator('.welcome-stage').count(),0);await p.reload();assert.equal(await p.locator('.welcome-stage').count(),0,'dismissed greeting returned');
  // Traverse authored story, intentionally declining brewing; no new rewards required.
  await p.evaluate(()=>{for(let n=0;n<50&&!document.querySelector('#season-skip');n++)document.querySelector('#season-next')?.click();document.querySelector('#season-skip')?.click();for(let n=0;n<30&&document.querySelector('#season-goodbye');n++)document.querySelector('#season-goodbye').click();});
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('c6s.cafe-season.v1')).visits.at(-1).closed),true);
  if(i<13)await p.locator('#season-continue').click();
 }
 assert.equal(new Set(ids).size,14);const original=await p.evaluate(()=>localStorage.getItem('c6s.cafe-season.v1'));
 const previewIds=[];for(let n=0;n<3;n++){await p.locator('#cafe-notebook').click();await p.locator('#preview-playful-welcome').click();previewIds.push(await p.locator('.welcome-stage').getAttribute('data-welcome-scene'));await p.locator('#season-enter').click();}assert.equal(new Set(previewIds).size,3);assert.equal(await p.evaluate(()=>localStorage.getItem('c6s.cafe-season.v1')),original);assert.deepEqual(errors,[]);await p.close();console.log(`${width}x${height} ${lang}: 14 unique visit greetings, all reactions fit, stable reload, persisted dismissal, optional story, rotating preview and immutable completed book`);
}}finally{await b.close();}
